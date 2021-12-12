package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"q"
	"strings"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	"github.com/aws/aws-sdk-go-v2/service/rekognition/types"
	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
)

var (
	renameCmd = &cli.Command{
		Use:   "rename",
		Short: "Rename",
		Run:   Rename,
	}
)

func init() {
	rootCmd.AddCommand(renameCmd)

	renameCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	renameCmd.PersistentFlags().StringP("source", "s", "", "Path to source image directory where image ids will be deduced.")
	renameCmd.PersistentFlags().StringP("reference-dir", "r", "", "Path to original step 2 reference images.")

	_ = renameCmd.MarkFlagRequired("source")
}

func Rename(cmd *cli.Command, args []string) {
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDir, _ := cmd.Flags().GetString("source")
	referenceDir, _ := cmd.Flags().GetString("reference-dir")

	log.Println("Start enhanced image renaming...")
	collectionId := getCollectionId(referenceDir)

	// currentTsStr := strconv.FormatInt(currentTs, 10)
	sourceBasename := filepath.Base(strings.TrimSuffix(sourceDir, "/"))
	outputDir := path.Join(outputParentDir, fmt.Sprintf("%s-rename", sourceBasename))
	err := os.MkdirAll(outputDir, 0755)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

	// Setup AWS -- https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/service/rekognition
	ctx := context.Background()
	awsConfig := NewAWSEnvConfig()
	// if debugMode {q.Q(os.Getenv("AWS_ACCESS_KEY_ID"), os.Getenv("AWS_SECRET_ACCESS_KEY"))}
	awsNativeConfig, err := config.LoadDefaultConfig(ctx, config.WithRegion(awsConfig.Region))
	if err != nil {
		log.Fatalf("ERROR: Cannot load AWS config %v\n", err.Error())
	}
	awsClient := rekognition.NewFromConfig(awsNativeConfig)

	// Read image from source directory
	// Cross-reference with aws face database/collection
	// Identify the image id
	// Write new image to output dir with new filename
	sourceFileExtensions := []string{"jpeg", "jpg", "png"}
	var sourceImgPaths []string
	for _, fileExt := range sourceFileExtensions {
		filePaths, err := filepath.Glob(path.Join(sourceDir, fmt.Sprintf("/*.%s", fileExt)))
		if err != nil {
			log.Fatal("ERROR: ", err)
		}
		sourceImgPaths = append(sourceImgPaths, filePaths...)
	}
	q.Q(sourceDir, sourceImgPaths)
	for _, sourceImgPath := range sourceImgPaths {
		img, _, _ := robotgo.DecodeImg(sourceImgPath)
		imgBytes, _ := ImageToBytes(img)

		// AWS call for face search
		searchResult, err := awsClient.SearchFacesByImage(ctx, &rekognition.SearchFacesByImageInput{
			CollectionId: &collectionId,
			Image: &types.Image{
				Bytes: imgBytes,
			},
		})
		if err != nil {
			log.Printf("ERROR: Failed to search for source image %v - %v\n", sourceImgPath, err.Error())
			continue
		}
		matchedFace := types.FaceMatch{}
		for _, match := range searchResult.FaceMatches {
			// Check if nil, because a direct comparison will throw an exception
			if matchedFace.Similarity == nil {
				matchedFace = match
				continue
			}
			if *match.Similarity > *matchedFace.Similarity {
				matchedFace = match
			}
		}
		if matchedFace.Similarity == nil {
			log.Printf("ERROR: No face matched for source image %v\n", sourceImgPath)
			continue
		}

		imageId := *matchedFace.Face.ExternalImageId

		if gcv.ImgWrite(path.Join(outputDir, fmt.Sprintf("%s.jpg", imageId)), img) {
			log.Printf("Successfully renamed image %v : %v\n", sourceImgPath, imageId)
		} else {
			log.Printf("Failed to rename image %v : %v\n", sourceImgPath, imageId)
		}
	}

	log.Println("Enhanced image renaming complete!")
}
