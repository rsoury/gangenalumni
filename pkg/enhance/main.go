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
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"log"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	"github.com/aws/aws-sdk-go-v2/service/rekognition/types"
	"github.com/disintegration/imaging"
	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
	"github.com/otiai10/gosseract/v2"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
	"gocv.io/x/gocv"
)

var (
	// The Root Cli Handler
	rootCmd = &cli.Command{
		Use:   "enhance",
		Short: "Enhance",
		Run:   EnhanceAll,
	}
	currentTs = time.Now().Unix()
	debugMode = false
)

func init() {
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Run the enhancement in debug mode. Will output images to tmp folder.")
	rootCmd.PersistentFlags().StringP("cascade-file", "c", "", "Path to local cascaseFile used for OpenCV FaceDetect Classifier.")
	rootCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	rootCmd.PersistentFlags().StringP("source", "s", "./output/step2", "Path to source image directory where image ids will be deduced.")
	rootCmd.PersistentFlags().Bool("index", false, "Index the source images before exeuction of the enhancement.")
	_ = rootCmd.MarkFlagRequired("source")
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
	currentTsStr := strconv.FormatInt(currentTs, 10)
	if debugMode {
		err = os.MkdirAll("./tmp/enhance-debug/"+currentTsStr, 0755) // Create tmp dir for this debug dump
		if err != nil {
			log.Fatalln("ERROR:", err)
		}
		log.Println("Start enhancement in debug mode...")
	} else {
		log.Println("Start enhancement...")
	}
	// Create output directory
	outputDir := path.Join(outputParentDir, currentTsStr)
	err = os.MkdirAll(outputDir, 0755)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

	// Setup Source Image Paths - Fetch all the image paths from the source directory
	sourceImagePaths, err := filepath.Glob(path.Join(sourceDir, "/*"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	// Index each face to an output directory
	var imageIndex []map[string]string

	// Setup AWS -- https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/service/rekognition
	ctx := context.Background()
	awsConfig := NewAWSEnvConfig()
	awsClient := rekognition.New(
		rekognition.Options{
			Region: awsConfig.Region,
		},
	)
	// Collection is determined by the step number + the timestamp of the image directory.
	collectionId := "2-" + filepath.Base(strings.TrimSuffix(sourceDir, "/"))
	if indexMode {
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

	bluestacks.StartOCR()
	defer bluestacks.OCRClient.Close()

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	screenImg := robotgo.CaptureImg()
	if debugMode {
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-0.jpg", screenImg)
	}

	//* These control coordinates only really need to be obtained once... and then reused accordingly.
	bluestacks.ScrollUp(50) // Scroll up to ensure that gallery button shows.
	galleryControlCoords, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/gallery.png", screenImg)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	bluestacks.MoveClick(galleryControlCoords.X, galleryControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for animation to finish
	screenImg = robotgo.CaptureImg()
	if debugMode {
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-1.jpg", screenImg)
	}
	folderFilterControlCoords, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/folder-filter.png", screenImg)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	bluestacks.MoveClick(folderFilterControlCoords.X, folderFilterControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for animation to finish
	screenImg = robotgo.CaptureImg()
	if debugMode {
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-2.jpg", screenImg)
	}
	sharedFolderControlCoords, err := bluestacks.GetTextCoordsInImage("SharedFolder", screenImg, gosseract.RIL_WORD)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	bluestacks.MoveClick(sharedFolderControlCoords.X, sharedFolderControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for the shared folder gallery to actually load

	// prepare image matrix
	screenImg = robotgo.CaptureImg()
	screenMat, _ := gocv.ImageToMatRGB(screenImg)
	defer screenMat.Close()

	// color for the rect when faces detected
	blue := color.RGBA{0, 0, 255, 0}

	// load classifier to recognize faces
	classifier := gocv.NewCascadeClassifier()
	defer classifier.Close()

	if !classifier.Load(cascadeFile) {
		log.Fatalf("Error reading cascade file: %v\n", cascadeFile)
	}

	// detect faces
	rects := classifier.DetectMultiScale(screenMat)
	var detectedFaces []image.Rectangle
	for _, r := range rects {
		if r.Dx() > 100 {
			detectedFaces = append(detectedFaces, r)
		}
	}
	log.Printf("Found %d faces\n", len(detectedFaces))

	// Add to the image index map
	for i, rect := range detectedFaces {
		// Run the enhancement process inside of this loop

		// 1. Click on the face to load it
		faceCoords := bluestacks.GetCoords((rect.Min.X+rect.Max.X)/2, (rect.Min.Y+rect.Max.Y)/2, screenImg)

		if i > 0 { // TESTING...
			continue
		}

		bluestacks.MoveClick(faceCoords.X, faceCoords.Y)
		// 2. Wait for the face to appear
		count := 0
		var validRects []image.Rectangle
		// var detectedScreenImg image.Image
		for {
			count++
			robotgo.MilliSleep(1000)
			editorImg := robotgo.CaptureImg()
			editorMat, _ := gocv.ImageToMatRGB(editorImg)
			defer editorMat.Close()
			sRects := classifier.DetectMultiScale(editorMat)
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
			gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%s/face-%d-%dx%d.jpg", currentTsStr, i, faceCoords.X, faceCoords.Y), detectedImg)
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
		for _, saveData := range imageIndex {
			if saveData["id"] == imageId {
				alreadyEnhanced = true
			}
		}

		if !alreadyEnhanced {
			// Run the enhancement process here.
		}

		// Use the back button to proceed with the next image
	}

	if debugMode {
		// draw a rectangle around each face on the original image,
		// along with text identifing as "Human"
		for _, r := range detectedFaces {
			gocv.Rectangle(&screenMat, r, blue, 3)

			size := gocv.GetTextSize("Human", gocv.FontHersheyPlain, 1.2, 2)
			pt := image.Pt(r.Min.X+(r.Min.X/2)-(size.X/2), r.Min.Y-2)
			gocv.PutText(&screenMat, "Human", pt, gocv.FontHersheyPlain, 1.2, blue, 2)
		}

		if gocv.IMWrite("./tmp/enhance-debug/"+currentTsStr+"/face-detect.jpg", screenMat) {
			log.Println("Successfully created image with faces detected")
		} else {
			log.Println("Failed to create image with faces detected")
		}
	}

	_ = beeep.Notify("Automatically Animated", "Enhancement script is complete", "")
}
