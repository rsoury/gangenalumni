package main

import (
	"context"
	"errors"
	"log"
	"path"
	"path/filepath"

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
}

func Index(cmd *cli.Command, args []string) {
	sourceDir, _ := cmd.Flags().GetString("source")

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
		log.Printf("ID: %s - %d faces indexed, %d faces detected but dismissed\n", name, len(output.FaceRecords), len(output.UnindexedFaces))
	}
}
