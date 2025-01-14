package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"path"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	"github.com/aws/aws-sdk-go-v2/service/rekognition/types"
	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
)

var (
	indexCmd = &cli.Command{
		Use:   "index",
		Short: "Index",
		Run:   Index,
	}
)

func init() {
	rootCmd.AddCommand(indexCmd)

	indexCmd.PersistentFlags().StringP("source", "s", "./output/step2", "Path to source step2 filtered images. These will be analysed and stored in a collection within AWS Rekognition for future face comparison.")
	indexCmd.PersistentFlags().BoolP("overwrite", "o", false, "Determine whether to overwrite the existing collection's image data.")

	indexCmd.MarkFlagRequired("source")
}

func Index(cmd *cli.Command, args []string) {
	sourceDir, _ := cmd.Flags().GetString("source")
	overwrite, _ := cmd.Flags().GetBool("overwrite")

	// Setup AWS -- https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/service/rekognition
	ctx := context.Background()
	awsConfig := NewAWSEnvConfig()
	// q.Q(os.Getenv("AWS_ACCESS_KEY_ID"), os.Getenv("AWS_SECRET_ACCESS_KEY"))
	awsNativeConfig, err := config.LoadDefaultConfig(ctx, config.WithRegion(awsConfig.Region))
	if err != nil {
		log.Fatalf("ERROR: Cannot load AWS config %v\n", err.Error())
	}
	awsClient := rekognition.NewFromConfig(awsNativeConfig)

	// Setup Source Image Paths - Fetch all the image paths from the source directory
	sourceImagePaths, err := filepath.Glob(path.Join(sourceDir, "/*.jpeg"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}

	// Collection is determined by the step number + the timestamp of the image directory.
	collectionId := getCollectionId(sourceDir)
	log.Printf("Indexing %d source images into collection %v ...\n", len(sourceImagePaths), collectionId)
	// Check if the collection exists -- if not, create it
	_, err = awsClient.DescribeCollection(ctx, &rekognition.DescribeCollectionInput{
		CollectionId: &collectionId,
	})
	if err != nil {
		var errorType *types.ResourceNotFoundException // https://aws.github.io/aws-sdk-go-v2/docs/handling-errors/
		if errors.As(err, &errorType) {
			newCollection, err := awsClient.CreateCollection(ctx, &rekognition.CreateCollectionInput{
				CollectionId: &collectionId,
				Tags: map[string]string{
					"Project": "NPC Companions",
				},
			})
			if err != nil {
				log.Fatalf("ERROR: Cannot create the collection %s - %v\n", collectionId, err.Error())
			}
			log.Printf("New collection %s created - %s\n", collectionId, *newCollection.CollectionArn)
		} else {
			log.Fatalf("ERROR: Cannot describe the collection %s - %v\n", collectionId, err.Error())
		}
	}
	// Get list of existing faces.
	var listedFaces []types.Face
	nextToken := ""
	for {
		listFacesOutput, err := awsClient.ListFaces(ctx, &rekognition.ListFacesInput{
			CollectionId: &collectionId,
			MaxResults:   aws.Int32(4096),
			NextToken:    &nextToken,
		})
		if err != nil {
			log.Fatalf("ERROR: Cannot list faces in collection %s - %v\n", collectionId, err.Error())
		}
		listedFaces = append(listedFaces, listFacesOutput.Faces...)
		if listFacesOutput.NextToken == nil {
			break
		}
		nextToken = *listFacesOutput.NextToken
	}
	log.Printf("%d faces found in collection\n", len(listedFaces))
	// Index the images in the source directory.
	for _, imagePath := range sourceImagePaths {
		img, _, _ := robotgo.DecodeImg(imagePath)
		imgBytes, err := ImageToBytes(img)
		if err != nil {
			log.Fatalf("ERROR: Cannot convert image to bytes: %v - %v", imagePath, err.Error())
		}
		filename := filepath.Base(imagePath)
		extension := filepath.Ext(filename)
		name := filename[0 : len(filename)-len(extension)]
		// If not overwrite, check if name exists in listed faces. If so, continue.
		if !overwrite {
			shouldSkip := false
			for _, scannedFace := range listedFaces {
				if name == *scannedFace.ExternalImageId {
					shouldSkip = true
					break
				}
			}
			if shouldSkip {
				log.Printf("ID: %s skipped\n", name)
				continue
			}
		}
		output, err := awsClient.IndexFaces(ctx, &rekognition.IndexFacesInput{
			CollectionId: &collectionId,
			Image: &types.Image{
				Bytes: imgBytes,
			},
			ExternalImageId: &name,
		})
		if err != nil {
			log.Fatalf("ERROR: Cannot index the image: %v - %v", imagePath, err.Error())
		}
		if len(output.FaceRecords) == 0 {
			jsonOutput, _ := json.Marshal(output)
			log.Printf("WARN: No faces detected: %v - %v", imagePath, string(jsonOutput))
		}
		log.Printf("ID: %s - %d faces indexed, %d faces detected but dismissed\n", name, len(output.FaceRecords), len(output.UnindexedFaces))
	}
}
