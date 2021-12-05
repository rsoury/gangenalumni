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
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"path"
	"path/filepath"
	"q"
	"strconv"
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
			detectedFaces = bluestacks.DetectFaces(screenImg, 100)
			log.Printf("Found %d faces in screen %d\n", len(detectedFaces), i)
		}
		rect, detectedFaces = detectedFaces[0], detectedFaces[1:]

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
			validRects = bluestacks.DetectFaces(screenImg, 100)
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
			go func() {
				// gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/face-"+strconv.Itoa(i)+"-"+strconv.Itoa(faceCoords.X)+"x"+strconv.Itoa(faceCoords.Y)+".jpg", detectedImg)
				gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/face-%d-%dx%d.jpg", currentTs, i, faceCoords.X, faceCoords.Y), detectedImg)
			}()
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
					_ = json.Unmarshal([]byte(file), &facedata)
					break
				}
			}

			faceDetails := facedata.FaceDetails[0]

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
				if enhancement.Name == "Glasses" {
					if faceDetails.Sunglasses.Value {
						applyEnhancement = true
						for _, t := range enhancement.Types {
							if t.Name == "Sunglasses" {
								eType = t
								break
							}
						}
					} else if faceDetails.Eyeglasses.Value {
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
					typeIndex := 0
					for {
						t := enhancementTypes[typeIndex]
						if rand.Float64() <= t.Probability {
							eType = t
							break
						} else {
							enhancementTypes[typeIndex].Probability = enhancementTypes[typeIndex].Probability * 1.2
							if enhancementTypes[typeIndex].Probability > 1.0 {
								enhancementTypes[typeIndex].Probability = 1.0
							}
						}
						typeIndex++
						if typeIndex > len(enhancementTypes) {
							typeIndex = 0
						}
					}
				}

				// proceed with enhancement
				editorScreenImg := robotgo.CaptureImg()
				eCoords, err := bluestacks.GetTextCoordsInImageWithCache(enhancement.Name, editorScreenImg, fmt.Sprintf("enhancement-%s", enhancement.Name))
				if err != nil {
					log.Printf("ERROR: Cannot select enhancement %s - %v\n", enhancement.Name, err.Error())
					continue
				}
				q.Q("Enhancement Coords: ", enhancement.Name, eCoords)
				bluestacks.MoveClick(eCoords.X, eCoords.Y)
				robotgo.MilliSleep(1000)
				editorScreenImg = robotgo.CaptureImg()
				if eType.ScrollRequirement > 0 {
					scrollReferenceEnhancementType := enhancement.Types[0]
					etCoords, err := bluestacks.GetTextCoordsInImageWithCache(scrollReferenceEnhancementType.Name, editorScreenImg, fmt.Sprintf("enhancement-type-%s", scrollReferenceEnhancementType.Name))
					q.Q("Scroll Reference Enhancement Type Coords: ", scrollReferenceEnhancementType.Name, etCoords)
					if err != nil {
						log.Printf("ERROR: Cannot find enhancement type %s for scroll reference - %v\n", scrollReferenceEnhancementType.Name, err.Error())
					}
					robotgo.Move(bluestacks.CenterCoords.X, etCoords.Y)
					robotgo.DragSmooth(bluestacks.CenterCoords.X-eType.ScrollRequirement, etCoords.Y)
					robotgo.MilliSleep(500)
					editorScreenImg = robotgo.CaptureImg() // Re-capture after the enhancement type horizontal scroll
				}
				if debugMode {
					go func() {
						gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/editor-screen-%s--%d.jpg", currentTs, eType.Name, time.Now().Unix()), editorScreenImg)
					}()
				}
				etCoords, err := bluestacks.GetTextCoordsInImageWithCache(eType.Name, editorScreenImg, fmt.Sprintf("enhancement-type-%s", eType.Name))
				q.Q("Enhancement Type Coords: ", eType.Name, etCoords)
				if err != nil {
					log.Printf("ERROR: Cannot find enhancement type %s - %v\n", eType.Name, err.Error())
					err = bluestacks.OsBackClick()
					if err != nil {
						log.Fatal("ERROR: ", err.Error())
					}
					continue
				}
				bluestacks.MoveClick(etCoords.X, etCoords.Y)
				// Wait for processing to finish
				// for {
				// 	robotgo.MilliSleep(2000)
				// 	loadingScreen := robotgo.CaptureImg()
				// 	_, err := bluestacks.GetTextCoordsInImage("Processing the photo...", loadingScreen, gosseract.RIL_TEXTLINE)
				// 	if err != nil {
				// 		if strings.Contains(err.Error(), "Cannot find the FaceApp") {
				// 			break
				// 		}
				// 	}
				// }
				//* We actually do need to wait for processing... simply press the Apply button
				applyCoords, err := bluestacks.GetTextCoordsInImageWithCache("Apply", editorScreenImg, "editor-apply")
				if err != nil {
					log.Printf("ERROR: Cannot find Apply text/button - %v\n", err.Error())
					err = bluestacks.OsBackClick()
					if err != nil {
						log.Fatal("ERROR: ", err.Error())
					}
					continue
				}
				bluestacks.MoveClick(applyCoords.X, applyCoords.X)

				enhancementsApplied = append(enhancementsApplied, map[string]string{
					"name": enhancement.Name,
					"type": eType.Name,
				})
			}

			enhancedFaceImgPath := ""
			if len(enhancementsApplied) > 0 {
				editorScreenImg := robotgo.CaptureImg()
				saveCoords, err := bluestacks.GetTextCoordsInImageWithCache("Save", editorScreenImg, "editor-save")
				if err != nil {
					log.Printf("ERROR: Cannot find Save text/button - %v\n", err.Error())
				}
				bluestacks.MoveClick(saveCoords.X, saveCoords.X)
				robotgo.MilliSleep(2000) // Wait for the save button to disappear
				editorScreenImg = robotgo.CaptureImg()
				detectedEnhancedFaces := bluestacks.DetectFaces(editorScreenImg, 100)
				if len(detectedEnhancedFaces) == 0 {
					log.Printf("ERROR: Cannot find Detected Enhanced Face - with index: %d\n", i)
					continue
				}
				if len(detectedEnhancedFaces) > 1 {
					log.Printf("WARN: Detected multiple faced after enhancement - with index: %d\n", i)
				}
				// Save detected enhanced face to output directory
				enhancedFaceImg := imaging.Crop(editorScreenImg, detectedEnhancedFaces[0])
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
			} else {
				log.Printf("No enhancements made to image - %v\n", imageId)
			}

			imageIndex = append(imageIndex, IndexedImage{
				Id:                imageId,
				Enhancements:      enhancementsApplied,
				EnhancedImagePath: enhancedFaceImgPath,
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
