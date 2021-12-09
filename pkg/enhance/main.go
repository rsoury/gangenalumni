/**
 * Step 2.1 -- An optional step
 * Enhance the Human Avatars using FaceApp in BlueStacks
 * Developed in Golang for to use robotgo
 *
 * Requires that Bluestacks 4 is open, and that Media Manager has imported all images.
 * Running enhance go script requires opencv4 as a dependency.
 * -- IMPORTANT: Be sure to switch the FaceApp Gender Interface to "Female interface" for Asset Compatibility
 */

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"io/ioutil"
	"log"
	"math"
	"math/rand"
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
	Id                string              `json:"id"`
	Enhancements      []map[string]string `json:"enhancements"`
	EnhancedImagePath string              `json:"enhancedImagePath"`
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
	rootCmd.PersistentFlags().Int("max-iterations", 0, "Max number of scroll iterations of enhancements.")
	_ = rootCmd.MarkFlagRequired("source")
	_ = rootCmd.MarkFlagRequired("facedata")
}

func main() {
	// Run the program
	if err := rootCmd.Execute(); err != nil {
		log.Fatalln("ERROR:", err)
	}
}

func EnhanceAll(cmd *cli.Command, args []string) {
	var err error

	debugMode, _ = cmd.Flags().GetBool("debug")
	cascadeFile, _ := cmd.Flags().GetString("cascade-file")
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDir, _ := cmd.Flags().GetString("source")
	facedataDir, _ := cmd.Flags().GetString("facedata")
	maxIterations, _ := cmd.Flags().GetInt("max-iterations")
	if debugMode {
		err = os.MkdirAll(fmt.Sprintf("./tmp/enhance-debug/%d", currentTs), 0755) // Create tmp dir for this debug dump
		if err != nil {
			log.Fatalln("ERROR:", err)
		}
		log.Println("Start enhancement in debug mode...")

		// Modify enhancements in Debug Mode to have all items with max probability
		for i := 0; i < len(enhancements); i++ {
			enhancements[i].Probability = 1
			for j := 0; j < len(enhancements[i].Types); j++ {
				enhancements[i].Types[j].Probability = 1
			}
		}
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
	collectionId := getCollectionId(sourceDir)

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

	// Setup Bluestacks
	bluestacks := NewBlueStacks()

	err = bluestacks.LoadFaceClassifier(cascadeFile)
	if err != nil {
		log.Fatalf("ERROR: %v", err.Error())
	}
	defer bluestacks.FaceClassifier.Close()

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	var detectedFaces []image.Rectangle
	var screenImg image.Image
	i := -1                  // Iterates for each face that is processed... not just an iteration for each set of faces
	setOfFacesProcessed := 0 // Iterates for each set of detected faces in gallery
	for {
		if maxIterations > 0 {
			if setOfFacesProcessed > maxIterations-1 {
				break
			}
		}

		// Iterate the count
		i++

		// For each iteration -- return the gallery... this way we can proceed with the next face directly from the gallery, and can scroll within the gallery.
		err = bluestacks.MoveToSharedFolderFromHome()
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}
		// We'll need to scroll to these images for each iteration -- ie. each time the gallery is reached, the scroll from the top is executed.
		// If we cannot scroll anymore, break the loop
		theEnd := false
		for s := 0; s < setOfFacesProcessed; s++ {
			// For each scroll induced by the iteration, compare the pre/post images. If we've iterated beyond the point of scrolling, then break.
			preImg := robotgo.CaptureImg()
			for miniS := 0; miniS < 2; miniS++ { // Perform miniscrolls inside of 1 scroll
				robotgo.Move(bluestacks.CenterCoords.X, bluestacks.CenterCoords.Y)
				robotgo.MilliSleep(500)
				robotgo.DragSmooth(bluestacks.CenterCoords.X, bluestacks.CenterCoords.Y-115) //* No matter what scroll dimension we provide, the amount of scroll seems to differ slightly.
			}
			robotgo.MilliSleep(500)
			postImg := robotgo.CaptureImg()
			if imagesSimilar(preImg, postImg) {
				// If after scrolling, the screen is the same, the break... -- this means that there are no more images to scroll
				theEnd = true
				break
			}
		}
		if theEnd {
			break
		}

		// Detect or iterate over the next face
		if len(detectedFaces) == 0 {
			screenImg = robotgo.CaptureImg()
			detectedFaces = bluestacks.DetectFaces(screenImg, 100)
			log.Printf("Found %d faces in screen %d\n", len(detectedFaces), setOfFacesProcessed)
			if debugMode {
				// color for the rect when faces detected
				borderColor := color.RGBA{0, 0, 255, 0}
				if setOfFacesProcessed%2 == 0 {
					borderColor = color.RGBA{255, 0, 0, 0}
				}
				// draw a rectangle around each face on the original image,
				// along with text identifing as "Human"
				screenMat, _ := gocv.ImageToMatRGB(screenImg)
				defer screenMat.Close()
				for _, r := range detectedFaces {
					gocv.Rectangle(&screenMat, r, borderColor, 3)

					size := gocv.GetTextSize("Human", gocv.FontHersheyPlain, 1.2, 2)
					pt := image.Pt(r.Min.X+(r.Min.X/2)-(size.X/2), r.Min.Y-2)
					gocv.PutText(&screenMat, "Human", pt, gocv.FontHersheyPlain, 1.2, borderColor, 2)
				}

				if gocv.IMWrite(fmt.Sprintf("./tmp/enhance-debug/%d/face-detect-screen-%d.jpg", currentTs, setOfFacesProcessed), screenMat) {
					log.Printf("Successfully created image with %d faces detected\n", len(detectedFaces))
				} else {
					log.Printf("Failed to create image with %d faces detected\n", len(detectedFaces))
				}
			}
		}

		var rect image.Rectangle
		rect, detectedFaces = detectedFaces[0], detectedFaces[1:]

		if len(detectedFaces) == 0 {
			// The set of faces process -- should index after we've emptied the detected faces for processing.
			// This increases the counter after we've emptied the detected faces array. This means that after the last face has been removed from the array for processing, we index, so that the next iteration where detection wll execute will also scroll prior to detection.
			setOfFacesProcessed++
		}

		// Run the enhancement process inside of this loop
		faceCoords := bluestacks.GetCoords((rect.Min.X+rect.Max.X)/2, (rect.Min.Y+rect.Max.Y)/2, screenImg)

		// Crop the detected the face within the gallery, and match it against the images in the source directory.
		// -- Using the face that was detected before the click to enhance -- This prevents the zoom out requirement
		detectedImg := imaging.Crop(screenImg, rect)
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

		log.Printf("[Face %d] Image ID %v has been identified\n", i, imageId)
		if debugMode {
			go func() {
				gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/face-%d-ID-%v.jpg", currentTs, i, imageId), detectedImg)
			}()
		}

		//! TEST
		imageIndex = append(imageIndex, IndexedImage{
			Id: imageId,
		})
		// Check if the face has already been enhanced
		alreadyEnhanced := false
		for _, indexedImage := range imageIndex {
			if indexedImage.Id == imageId {
				alreadyEnhanced = true
				break
			}
		}

		// Continue with the next iteration if this face has already been enhanced.
		if alreadyEnhanced {
			log.Printf("[Face %d] Image ID %v has already been enhanced", i, imageId)
			err = bluestacks.OsBackClick() // Exit back to Home screen from the Gallery
			if err != nil {
				log.Fatal("ERROR: ", err.Error())
			}
			continue
		}

		// 1. Click on the face to load it
		bluestacks.MoveClick(faceCoords.X, faceCoords.Y)
		log.Printf("[Face %d] Image ID %v selected...\n", i, imageId)

		// 2. Wait for the face to appear
		count := 0
		var validRects []image.Rectangle
		for {
			count++
			robotgo.MilliSleep(2000)
			validRects = bluestacks.DetectFaces(screenImg, 100)
			if len(validRects) > 0 || count > 10 {
				break
			}
		}
		// Skip the image if it has not been detected -- Could becasue FaceApp failed to detect the image too
		if len(validRects) == 0 {
			log.Printf("WARN: [Face %d] No detection after selection...\n", i)
			err = bluestacks.OsBackClick() // Exit back to home screen
			if err != nil {
				log.Fatal("ERROR: ", err.Error())
			}
			continue
		}

		log.Printf("[Face %d] Starting enhancement for Image ID %v ...\n", i, imageId)

		// 3. Run the enhancement process here.

		// 3.1. Determine the enhancements
		// -- 3.1.1. Check if user has beard -- add beard. -- random selection of beard type depending on if mustache/beard
		// -- 3.1.2. Check if user has glasses -- add glasses -- random selection
		// -- 3.1.3. Check if female, and probability for make up -- add make up -- random selection
		// -- 3.1.4. Plus size the person by chance too -- there should be heavier people.
		// 3.2. Iterate and apply the enhancements
		// -- 3.2.1. Select enhancement
		// -- 3.2.2. Wait for the processing text to no longer show
		// -- 3.2.3. Select the Apply text
		// -- 3.2.4. Select the Save text
		// -- 3.2.5. Detect the image inside of the Save Screen
		// -- 3.2.6. Click the back button -- to get back to the Editor

		facedata := FaceData{}
		for _, facedataPath := range facedataPaths {
			filename := filepath.Base(facedataPath)
			extension := filepath.Ext(filename)
			name := filename[0 : len(filename)-len(extension)]
			if name == imageId {
				// Read the file and unmarshal the data
				file, _ := ioutil.ReadFile(facedataPath)
				_ = json.Unmarshal([]byte(file), &facedata)
				break
			}
		}

		faceDetails := facedata.FaceDetails[0]
		if (*faceDetails.AgeRange.Low) < 16 {
			log.Printf("Character is underage - Image ID %v\n", imageId)
			err = bluestacks.OsBackClick()
			if err != nil {
				log.Fatal("ERROR: ", err.Error())
			}
			continue
		}

		enhancementsApplied := []map[string]string{}
		for _, enhancement := range enhancements {
			applyEnhancement := false
			eType := EnhancementType{}
			if enhancement.GenderRequirement != "" {
				if enhancement.GenderRequirement != string(faceDetails.Gender.Value) {
					continue
				}
			}
			if enhancement.Name == "Beards" {
				if faceDetails.Beard.Value {
					applyEnhancement = true
				}
			}
			if !applyEnhancement {
				// Apply probabilty for enhancement
				applyEnhancement = rand.Float64() <= enhancement.Probability
			}
			if !applyEnhancement {
				continue
			}
			if len(eType.Name) == 0 {
				// Select the type of enhancement -- // First, Clone and shuffle the enhacements types
				enhancementTypes := enhancement.ShuffleTypes()
				for typeIndex := 0; typeIndex < len(enhancementTypes); typeIndex++ {
					if rand.Float64() <= enhancementTypes[typeIndex].Probability {
						eType = enhancementTypes[typeIndex]
						break
					} else {
						enhancementTypes[typeIndex].Probability = enhancementTypes[typeIndex].Probability * 1.2
						if enhancementTypes[typeIndex].Probability > 1.0 {
							enhancementTypes[typeIndex].Probability = 1.0
						}
					}
				}
			}

			// proceed with enhancement
			log.Printf("Image ID %v - Entering into enhancement %s ... \n", imageId, enhancement.Name)
			editorScreenImg := robotgo.CaptureImg()
			eCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
				return bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/enhancement-%s.png", strings.ToLower(strings.ReplaceAll(enhancement.Name, " ", "-"))), editorScreenImg)
			}, fmt.Sprintf("enhancement-%s", enhancement.Name))
			if err != nil {
				log.Printf("ERROR: Cannot select enhancement %s - %v\n", enhancement.Name, err.Error())
				continue
			}
			q.Q("Enhancement Coords: ", enhancement.Name, eCoords)
			bluestacks.MoveClick(eCoords.X, eCoords.Y)
			robotgo.MilliSleep(1000)
			log.Printf("Image ID %v - Entered into enhancement %s\n", imageId, enhancement.Name)

			editorScreenImg = robotgo.CaptureImg()
			if eType.ScrollRequirement > 0 {
				var scrollReferenceEnhancementType EnhancementType
				for _, t := range enhancement.Types {
					if t.ScrollRequirement == 0 {
						scrollReferenceEnhancementType = t
						break
					}
				}
				log.Printf("Image ID %v - Finding scroll reference of type %s to find enhancement %s type %s ... \n", imageId, scrollReferenceEnhancementType.Name, enhancement.Name, eType.Name)
				// etCoords, err := bluestacks.GetTextCoordsInImageWithCache(scrollReferenceEnhancementType.Name, intenseEditorScreenImg, fmt.Sprintf("enhancement-type-%s", scrollReferenceEnhancementType.Name))
				etCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
					return bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/etype-%s-%s.png", strings.ToLower(strings.ReplaceAll(enhancement.Name, " ", "-")), strings.ToLower(strings.ReplaceAll(scrollReferenceEnhancementType.Name, " ", "-"))), editorScreenImg)
				}, fmt.Sprintf("enhancement-type-%s", scrollReferenceEnhancementType.Name))
				q.Q("Scroll Reference Enhancement Type Coords: ", scrollReferenceEnhancementType.Name, etCoords)
				if err != nil {
					log.Printf("ERROR: Cannot find enhancement type %s for scroll reference - %v\n", scrollReferenceEnhancementType.Name, err.Error())
					err = bluestacks.OsBackClick() // Exit from enhancement type selection screen
					if err != nil {
						log.Fatal("ERROR: ", err.Error())
					}
					robotgo.MilliSleep(1000)
					continue
				}
				scrollIterations := int(math.Round(float64(eType.ScrollRequirement) / 200.0))
				for s := 0; s < scrollIterations; s++ {
					robotgo.Move(bluestacks.CenterCoords.X, etCoords.Y)
					robotgo.MilliSleep(500)
					robotgo.DragSmooth(bluestacks.CenterCoords.X-200, etCoords.Y)
				}
				robotgo.MilliSleep(1000)
				editorScreenImg = robotgo.CaptureImg() // Re-capture after the enhancement type horizontal scroll
				log.Printf("Image ID %v - Horizontal scroll to find enhancement %s type %s\n", imageId, enhancement.Name, scrollReferenceEnhancementType.Name)
			}
			if debugMode {
				go func() {
					gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/editor-screen-%s--%d.jpg", currentTs, eType.Name, time.Now().Unix()), editorScreenImg)
				}()
			}

			log.Printf("Image ID %v - Attempting to enhance using enhancement %s type %s ... \n", imageId, enhancement.Name, eType.Name)
			etCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
				return bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/etype-%s-%s.png", strings.ToLower(strings.ReplaceAll(enhancement.Name, " ", "-")), strings.ToLower(strings.ReplaceAll(eType.Name, " ", "-"))), editorScreenImg)
			}, fmt.Sprintf("enhancement-type-%s", eType.Name))
			q.Q("Enhancement Type Coords: ", eType.Name, etCoords)
			if err != nil {
				log.Printf("ERROR: Cannot find enhancement type %s - %v\n", eType.Name, err.Error())
				err = bluestacks.OsBackClick() // Exit from enhancement type selection screen
				if err != nil {
					log.Fatal("ERROR: ", err.Error())
				}
				err = bluestacks.ExitScreen(len(enhancementsApplied) > 0) // Exit from enhancement screen back to home screen
				if err != nil {
					log.Fatal("ERROR: ", err.Error())
				}
				continue
			}
			bluestacks.MoveClick(etCoords.X, etCoords.Y)
			log.Printf("Image ID %v - Enhanced using enhancement %s type %s\n", imageId, enhancement.Name, eType.Name)
			applyCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
				return bluestacks.GetImagePathCoordsInImage("./assets/faceapp/apply.png", editorScreenImg)
			}, "editor-apply")
			if err != nil {
				log.Fatalf("ERROR: Cannot find Apply text/button - %v\n", err.Error())
				continue
			}
			q.Q("Apply Coords: ", applyCoords)
			bluestacks.MoveClick(applyCoords.X, applyCoords.Y)
			robotgo.Click()          // Double click to make sure....
			robotgo.MilliSleep(2000) // Wait for Apply and return to editor screen animation
			log.Printf("Image ID %v - Enhancements applied\n", imageId)

			enhancementsApplied = append(enhancementsApplied, map[string]string{
				"name": enhancement.Name,
				"type": eType.Name,
			})
		}

		enhancedFaceImgPath := ""
		if len(enhancementsApplied) > 0 {
			editorScreenImg := robotgo.CaptureImg()
			saveCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
				return bluestacks.GetImagePathCoordsInImage("./assets/faceapp/save.png", editorScreenImg)
			}, "editor-save")
			if err != nil {
				log.Fatalf("ERROR: Cannot find Save text/button - %v\n", err.Error())
				continue
			}
			q.Q("Save Coords: ", saveCoords)
			saveCount := 0
			isSaved := false
			var postSaveImg image.Image
			for {
				bluestacks.MoveClick(saveCoords.X, saveCoords.Y)
				robotgo.Click()          // Double click to make sure...
				robotgo.MilliSleep(2000) // Wait for the save button to disappear
				postSaveImg = robotgo.CaptureImg()
				if imagesSimilar(editorScreenImg, postSaveImg) {
					saveCount++
				} else {
					isSaved = true
					break
				}
				if saveCount > 4 {
					// Try 5 times
					break
				}
			}
			if !isSaved {
				log.Printf("WARN: [Face %d] Image ID %v - Failed to Saved. Added back into loop\n", i, imageId)
				detectedFaces = append(detectedFaces, rect)               // Add the face back into the loop if there was an error saving for whatever reason
				err = bluestacks.ExitScreen(len(enhancementsApplied) > 0) // Exit the enhancement selection screen to the gallery screen
				if err != nil {
					log.Fatal("ERROR: ", err.Error())
				}
				robotgo.MilliSleep(1000)
				continue
			}
			log.Printf("[Face %d] Image ID %v - Saved\n", i, imageId)
			detectedEnhancedFaces := bluestacks.DetectFaces(postSaveImg, 300) // Increase validity integer to prevent detching before & after faces
			if len(detectedEnhancedFaces) == 0 {
				log.Printf("ERROR: Cannot find Detected Enhanced Face - with index: %d\n", i)
				continue
			}
			if len(detectedEnhancedFaces) > 1 {
				// This was being hit due to the images inside of then Before & After image.
				log.Printf("WARN: Detected multiple faced after enhancement - with index: %d\n", i)
			}
			// Save detected enhanced face to output directory
			enhancedFaceImg := imaging.Crop(postSaveImg, detectedEnhancedFaces[0])
			enhancedFaceImgPath = path.Join(outputDir, fmt.Sprintf("%v.jpeg", imageId))
			go func() {
				if gcv.ImgWrite(enhancedFaceImgPath, enhancedFaceImg) {
					log.Printf("Successfully saved detected enhanced image - %v\n", imageId)
				} else {
					log.Printf("WARN: Failed to save detected enhanced image - %v\n", imageId)
				}
			}()

			// Use the back button to return to the Editor Screen
			err = bluestacks.OsBackClick()
			if err != nil {
				log.Fatal("ERROR: ", err.Error())
			}
		}
		log.Printf("[Face %d] %d enhancements made for Image ID %v\n", i, len(enhancementsApplied), imageId)

		imageIndex = append(imageIndex, IndexedImage{
			Id:                imageId,
			Enhancements:      enhancementsApplied,
			EnhancedImagePath: enhancedFaceImgPath,
		})

		// Use the back button to return to the Home Screen -- Exit the Editor Screen.
		err = bluestacks.OsBackClick()
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}
	}

	// Save Image Index to file
	// https://www.socketloop.com/tutorials/golang-save-map-struct-to-json-or-xml-file
	imageIndexJson, err := json.Marshal(imageIndex)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	jsonFile, err := os.Create(path.Join(outputDir, "index.json"))
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
