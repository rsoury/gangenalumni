/**
 * Step 2.1 -- An optional step
 * Enhance the Human Avatars using FaceApp in BlueStacks
 * Developed in Golang for to use robotgo
 *
 * Requires that Bluestacks 4 is open, and that Media Manager has imported all images.
 * Running enhance go script requires opencv4 as a dependency.
 */

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"q"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	"github.com/aws/aws-sdk-go-v2/service/rekognition/types"
	"github.com/disintegration/imaging"
	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
	"gocv.io/x/gocv"
)

type IndexedImage struct {
	Id                string `json:"id"`
	EnhancedImagePath string `json:"enhancedImagePath"`
}

type FaceData struct {
	FaceDetails []types.FaceDetail `json:"FaceDetails"`
}

var (
	// The Root Cli Handler
	rootCmd = &cli.Command{
		Use:   "enhance",
		Short: "Enhance",
		Run:   EnhanceAll,
	}
	currentTs = time.Now().Unix()
	debugMode = false
	// Index each face to an output directory
	imageIndex []IndexedImage
)

func init() {
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Run the enhancement in debug mode. Will output images to tmp folder.")
	rootCmd.PersistentFlags().StringP("cascade-file", "c", "", "Path to local cascaseFile used for OpenCV FaceDetect Classifier.")
	rootCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	rootCmd.PersistentFlags().StringP("source", "s", "./output/step2", "Path to source image directory where image ids will be deduced.")
	rootCmd.PersistentFlags().StringP("facedata", "f", "", "Path to AWS Face Analysis dataset directory.")
	rootCmd.PersistentFlags().Bool("index", false, "Index the source images before exeuction of the enhancement.")
	_ = rootCmd.MarkFlagRequired("source")
	_ = rootCmd.MarkFlagRequired("facedata")
}

func main() {
	// Run the program
	if err := rootCmd.Execute(); err != nil {
		log.Fatalln("ERROR:", err)
	}
}

func ImageToBytes(img image.Image) ([]byte, error) {
	buf := new(bytes.Buffer)
	err := jpeg.Encode(buf, img, nil)
	if err != nil {
		return buf.Bytes(), err
	}
	imgBytes := buf.Bytes()
	return imgBytes, nil
}

func EnhanceAll(cmd *cli.Command, args []string) {
	var err error

	debugMode, _ = cmd.Flags().GetBool("debug")
	indexMode, _ := cmd.Flags().GetBool("index")
	cascadeFile, _ := cmd.Flags().GetString("cascade-file")
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDir, _ := cmd.Flags().GetString("source")
	facedataDir, _ := cmd.Flags().GetString("facedata")
	if debugMode {
		err = os.MkdirAll(fmt.Sprintf("./tmp/enhance-debug/%d", currentTs), 0755) // Create tmp dir for this debug dump
		if err != nil {
			log.Fatalln("ERROR:", err)
		}
		log.Println("Start enhancement in debug mode...")
	} else {
		log.Println("Start enhancement...")
	}
	// Create output directory
	currentTsStr := strconv.FormatInt(currentTs, 10)
	outputDir := path.Join(outputParentDir, currentTsStr)
	err = os.MkdirAll(outputDir, 0755)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

	// Setup Source Image Paths - Fetch all the image paths from the source directory
	sourceImagePaths, err := filepath.Glob(path.Join(sourceDir, "/*.{jpeg,jpg,png}"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}

	// Setup Face Analysis Data Paths - Fetch all the JSON paths from the facedata directory
	facedataPaths, err := filepath.Glob(path.Join(facedataDir, "/*.json"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}

	// Setup AWS -- https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/service/rekognition
	ctx := context.Background()
	awsConfig := NewAWSEnvConfig()
	// q.Q(os.Getenv("AWS_ACCESS_KEY_ID"), os.Getenv("AWS_SECRET_ACCESS_KEY"))
	awsNativeConfig, err := config.LoadDefaultConfig(ctx, config.WithRegion(awsConfig.Region))
	if err != nil {
		log.Fatalf("ERROR: Cannot load AWS config %v\n", err.Error())
	}
	awsClient := rekognition.NewFromConfig(awsNativeConfig)

	// Collection is determined by the step number + the timestamp of the image directory.
	collectionId := "npcc-2-" + filepath.Base(strings.TrimSuffix(sourceDir, "/"))
	if indexMode {
		log.Printf("Indexing %d source images into collection %v ...\n", len(sourceImagePaths), collectionId)
		// Check if the collection exists -- if not, create it
		_, err := awsClient.DescribeCollection(ctx, &rekognition.DescribeCollectionInput{
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

	// Setup Bluestacks
	bluestacks := NewBlueStacks()

	err = bluestacks.LoadFaceClassifier(cascadeFile)
	if err != nil {
		log.Fatalf("ERROR: %v", err.Error())
	}
	defer bluestacks.FaceClassifier.Close()

	bluestacks.StartOCR()
	defer bluestacks.OCRClient.Close()

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	var detectedFaces []image.Rectangle
	var screenImg image.Image
	i := 0
	for {
		// These control coordinates only really need to be obtained once... and then reused accordingly.
		// For each of the faces -- return the gallery
		err = bluestacks.MoveToSharedFolderFromHome()
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}

		// Detect or iterate over the next face
		var rect image.Rectangle
		if len(detectedFaces) == 0 {
			screenImg = robotgo.CaptureImg()
			detectedFaces = bluestacks.DetectFaces(screenImg)
			log.Printf("Found %d faces in screen %d\n", len(detectedFaces), i)
		}
		// if len(detectedFaces) > 0 {
		// } else {
		// 	log.Fatalf("ERROR: No detected faces to process in screen %d\n", i)
		// }
		rect, detectedFaces = detectedFaces[0], detectedFaces[1:]
		q.Q(rect)

		// Run the enhancement process inside of this loop

		// 1. Click on the face to load it
		faceCoords := bluestacks.GetCoords((rect.Min.X+rect.Max.X)/2, (rect.Min.Y+rect.Max.Y)/2, screenImg)
		bluestacks.MoveClick(faceCoords.X, faceCoords.Y)

		// 2. Wait for the face to appear
		count := 0
		var validRects []image.Rectangle
		for {
			count++
			robotgo.MilliSleep(2000)
			sRects := bluestacks.DetectFaces(screenImg)
			for _, r := range sRects {
				if r.Dx() > 100 {
					validRects = append(validRects, r)
				}
			}
			if len(validRects) > 0 || count > 10 {
				break
			}
		}
		// Skip the image if it has not been detected -- Could becasue FaceApp failed to detect the image too
		if len(validRects) == 0 {
			continue
		}

		// 3. Once the face is detected, match it against the images in the source directory.
		// -- Use the face that was detected before the click to enhance -- This prevents the zoom out requirement
		detectedImg := imaging.Crop(screenImg, rect)
		if debugMode {
			// gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/face-"+strconv.Itoa(i)+"-"+strconv.Itoa(faceCoords.X)+"x"+strconv.Itoa(faceCoords.Y)+".jpg", detectedImg)
			gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/face-%d-%dx%d.jpg", currentTs, i, faceCoords.X, faceCoords.Y), detectedImg)
		}
		detectedImgBytes, _ := ImageToBytes(detectedImg)
		// AWS call for face search
		searchResult, err := awsClient.SearchFacesByImage(ctx, &rekognition.SearchFacesByImageInput{
			CollectionId: &collectionId,
			Image: &types.Image{
				Bytes: detectedImgBytes,
			},
		})
		if err != nil {
			log.Fatalf("ERROR: Failed to search for pre-enhanced detected image - %d-%dx%d - %v", i, faceCoords.X, faceCoords.Y, err.Error())
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
		if *matchedFace.Similarity == 0 {
			log.Fatalf("ERROR: No face matched for pre-enhanced detected image - %d-%dx%d - %v", i, faceCoords.X, faceCoords.Y, err.Error())
		}

		// Now that we have the matched face, we can produce the enhancement, then detect the enhanced face to save against the matched image id.
		imageId := *matchedFace.Face.ExternalImageId
		// First, check if the image has already been enhanced
		// 0. Check if the face has already been enhanced
		alreadyEnhanced := false
		for _, indexedImage := range imageIndex {
			if indexedImage.Id == imageId {
				alreadyEnhanced = true
				break
			}
		}

		if !alreadyEnhanced {
			// Run the enhancement process here.
			// 1. Determine the enhancements
			// -- 1. Check if user has beard -- add beard. -- random selection of beard type depending on if mustache/beard
			// -- 2. Check if user has glasses -- add glasses -- random selection
			// -- 3. Check if female, and probability for make up -- add make up -- random selection
			// -- 4. Plus size the person by chance too -- there should be heavier people.
			// 2. Iterate and apply the enhancements
			// -- 1. Select enhancement
			// -- 2. Wait for the processing text to no longer show
			// -- 3. Select the Apply text
			// -- 4. Select the Save text
			// -- 5. Detect the image inside of the Save Screen
			// -- 6. Click the back button -- to get back to the Editor

			// facedataMap := map[string]interface{}{}
			facedata := FaceData{}
			for _, facedataPath := range facedataPaths {
				filename := filepath.Base(facedataPath)
				extension := filepath.Ext(filename)
				name := filename[0 : len(filename)-len(extension)]
				if name == imageId {
					// Read the file and unmarshal the data
					file, _ := ioutil.ReadFile(facedataPath)
					// _ = json.Unmarshal([]byte(file), &facedataMap)
					// err := mapstructure.Decode(facedataMap, &facedata)
					// if err != nil {
					// 	log.Printf("ERROR: Cannot unmarshal face data into structure: %v", err.Error())
					// }
					_ = json.Unmarshal([]byte(file), &facedata)
					break
				}
			}

			q.Q(facedata)

			imageIndex = append(imageIndex, IndexedImage{
				Id:                imageId,
				EnhancedImagePath: "",
			})
		}

		// Use the back button to return to the Home Screen
		err = bluestacks.OsBackClick()
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}

		// Iterate the count
		i++

		if len(detectedFaces) == 0 {
			// Here we'd scroll depending on whether a scroll is required.
			// If we cannot scroll anymore, break the loop
			if i > 0 { // Test -- If not the first iteration AND detectedFaces is empty.
				break
			}

			if debugMode {
				go func() {
					// color for the rect when faces detected
					blue := color.RGBA{0, 0, 255, 0}
					// draw a rectangle around each face on the original image,
					// along with text identifing as "Human"
					screenMat, _ := gocv.ImageToMatRGB(screenImg)
					defer screenMat.Close()
					for _, r := range detectedFaces {
						gocv.Rectangle(&screenMat, r, blue, 3)

						size := gocv.GetTextSize("Human", gocv.FontHersheyPlain, 1.2, 2)
						pt := image.Pt(r.Min.X+(r.Min.X/2)-(size.X/2), r.Min.Y-2)
						gocv.PutText(&screenMat, "Human", pt, gocv.FontHersheyPlain, 1.2, blue, 2)
					}

					if gocv.IMWrite(fmt.Sprintf("./tmp/enhance-debug/%d/face-detect-%d.jpg", currentTs, i), screenMat) {
						log.Printf("Successfully created image with faces detected\n")
					} else {
						log.Printf("Failed to create image with faces detected\n")
					}
				}()
			}
		}
	}

	// Save Image Index to file
	// https://www.socketloop.com/tutorials/golang-save-map-struct-to-json-or-xml-file
	imageIndexJson, err := json.Marshal(imageIndex)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	jsonFile, err := os.Create(filepath.Join(outputDir, "index.json"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	defer jsonFile.Close()
	_, err = jsonFile.Write(imageIndexJson)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	jsonFile.Close()
	log.Println("JSON data written to ", jsonFile.Name())

	// Desktop notification of completion
	_ = beeep.Notify("Automatically Animated", "Enhancement script is complete", "")
}
