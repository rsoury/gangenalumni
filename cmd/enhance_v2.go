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
	"encoding/json"
	"fmt"
	"image"
	"io/ioutil"
	"log"
	"math"
	"math/rand"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
	"github.com/vcaesar/imgo"
)

var (
	// The Root Cli Handler
	enhanceV2Cmd = &cli.Command{
		Use:   "enhance-v2",
		Short: "Enhance images with FaceApp + Desktop Automation -- Enhances by importing images in source directory and processing one at a time.",
		Run:   EnhanceV2,
	}
)

func init() {
	rootCmd.AddCommand(enhanceV2Cmd)

	enhanceV2Cmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	enhanceV2Cmd.PersistentFlags().StringP("source", "s", "./output/step2", "Path to source image directory where image ids will be deduced.")
	enhanceV2Cmd.PersistentFlags().StringP("cascade-file", "c", "", "Path to local cascaseFile used for OpenCV FaceDetect Classifier.")
	enhanceV2Cmd.PersistentFlags().StringP("facedata", "f", "", "Path to AWS Face Analysis dataset directory.")
	enhanceV2Cmd.PersistentFlags().Int("max-iterations", 0, "Max number of scroll iterations of enhancements.")
	_ = enhanceV2Cmd.MarkFlagRequired("source")
	_ = enhanceV2Cmd.MarkFlagRequired("facedata")
}

func EnhanceV2(cmd *cli.Command, args []string) {
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

	// Setup Face Analysis Data Paths - Fetch all the JSON paths from the facedata directory
	facedataPaths, err := filepath.Glob(path.Join(facedataDir, "/*.json"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}

	// Setup Bluestacks
	bluestacks := NewBlueStacks()

	err = bluestacks.LoadFaceClassifier(cascadeFile)
	if err != nil {
		log.Fatalf("ERROR: %v", err.Error())
	}
	defer bluestacks.FaceClassifier.Close()

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	// Start from the Home Screen
	// 1. Iterate over each image in Source Dir
	// 2. For each image, open Media Manage, wait for File Picker, use Shift+Cmd+g to navigate to the target file and use "Enter" to open
	// 3. Close the Media Manager using the X -- Right hand side of the Control
	// 4. Open FaceApp with Tab Control -- Use Triple Click -- Doesn't matter the number of clicks.
	// 5. Navigate to SharedFolder
	// 6. Click in the first image region -- Use the Folder-Filter control select image in the first region -- ie. add to Y coord.
	// 7. Peform standard enhancement process
	// 8. Return to the Home Screen for Media Manager to be used again

	imagePaths, err := filepath.Glob(path.Join(sourceDir, "/*.jpeg"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	screenImg := robotgo.CaptureImg()
	if debugMode {
		go func() {
			gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/home-screen.jpg", currentTs), screenImg)
		}()
	}
	mediaManagerAppCoords, _, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/media-manager-app-control.png", screenImg)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	closeMediaManager := func() {
		currentScreen := robotgo.CaptureImg()
		mediaManagerTabImagePath := "./assets/faceapp/media-manager-tab-control.png"
		mediaManagerTabCloseCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
			mediaManagerTabCoords, _, err := bluestacks.GetImagePathCoordsInImage(mediaManagerTabImagePath, currentScreen)
			mediaManagerTabImg, _, _ := imgo.DecodeFile(mediaManagerTabImagePath)
			widthRatio := float64(mediaManagerTabImg.Bounds().Max.X) / float64(currentScreen.Bounds().Max.X)
			relativeWidth := float64(bluestacks.ScreenWidth) * float64(widthRatio)
			coords := Coords{
				X: int(math.Round(float64(mediaManagerTabCoords.X) + (relativeWidth / 2))),
				Y: mediaManagerTabCoords.Y,
			}
			return coords, err
		}, "media-tab")
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}
		bluestacks.MoveClick(mediaManagerTabCloseCoords.X, mediaManagerTabCloseCoords.Y)
	}
	var detectedEnhancedFaces []image.Rectangle // Cache of faces saved in post-save screen
	for i, imagePath := range imagePaths {
		if maxIterations > 0 {
			if i > maxIterations-1 {
				break
			}
		}
		imageId := getFileName(imagePath)

		log.Printf("[Face %v] Running checks...", imageId)

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
			log.Printf("[Face %v] Image has already been enhanced", imageId)
			continue
		}

		// 1. Fetch the facedata details
		facedata := FaceData{}
		for _, facedataPath := range facedataPaths {
			name := getFileName(facedataPath)
			if name == imageId {
				// Read the file and unmarshal the data
				file, _ := ioutil.ReadFile(facedataPath)
				_ = json.Unmarshal([]byte(file), &facedata)
				break
			}
		}
		faceDetails := facedata.FaceDetails[0]

		// 2. Ensure the character is of age
		if (*faceDetails.AgeRange.Low) < 16 {
			log.Printf("Character is underage. Skipping enhancement... %v\n", imageId)
			continue
		}

		log.Printf("[Face %v] Importing image ...", imageId)

		bluestacks.MoveClick(mediaManagerAppCoords.X, mediaManagerAppCoords.Y)
		robotgo.MilliSleep(500)
		mediaManagerScreen := robotgo.CaptureImg()
		importCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
			coords, _, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/import-control.png", mediaManagerScreen)
			return coords, err
		}, "import")
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}
		bluestacks.MoveClick(importCoords.X, importCoords.Y)
		robotgo.MilliSleep(500)
		// 4. Wait for the filepicker to show
		isFilePickerAvailable := bluestacks.WaitForElement("./assets/faceapp/filepicker-indicator.png", 2000, 10)
		if !isFilePickerAvailable {
			log.Printf("WARN: [Face %v] File picker not showing...\n", imageId)
			// Close Media Manager
			closeMediaManager()
			continue
		}

		// Open Path finder in FilePicker
		robotgo.KeyTap("g", "shift", "cmd")
		robotgo.MilliSleep(1000)
		// Insert path to string
		absPath, _ := filepath.Abs(imagePath)
		bluestacks.TypeStr(absPath)
		robotgo.MilliSleep(500)
		// Show file
		robotgo.KeyTap("enter")
		robotgo.MilliSleep(500)
		// Open file
		robotgo.KeyTap("enter")

		robotgo.MilliSleep(1000)

		// Close Media Manager
		closeMediaManager()
		log.Printf("[Face %v] Image imported!\n", imageId)

		// Open Face App
		log.Printf("[Face %v] Processing image ...", imageId)
		currentScreen := robotgo.CaptureImg()
		faTabCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
			coords, _, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/faceapp-tab-control.png", currentScreen)
			return coords, err
		}, "faceapp-tab")
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}
		bluestacks.MoveClick(int(math.Round(float64(bluestacks.ScreenWidth)/2)), int(math.Round(float64(bluestacks.ScreenHeight)/2)))
		robotgo.MilliSleep(100)
		bluestacks.MoveClick(faTabCoords.X, faTabCoords.Y)
		robotgo.MilliSleep(200)
		robotgo.Click()
		robotgo.MilliSleep(200)
		robotgo.Click()

		robotgo.MilliSleep(1000) // In case there is a Splash Screen

		// Move the SharedFolder -- recently imported doesn't always show first on the home screen
		err = bluestacks.MoveToSharedFolderFromHome()
		if err != nil {
			log.Fatal("ERROR: ", err.Error())
		}

		// Used cached filter-foder coords to get coords relative to first image
		folderFilterCoords, _ := bluestacks.GetCoordsWithCache(func() (Coords, error) {
			return Coords{}, nil
		}, "filterFolder")
		bluestacks.MoveClick(folderFilterCoords.X, folderFilterCoords.Y+int(math.Round(float64(bluestacks.ScreenHeight)*0.1)))
		log.Printf("[Face %v] Image selected for enhancing...\n", imageId)

		// 4. Wait for the an enhancement to show
		count := 0
		selectedFaceLoaded := false
		for {
			count++
			robotgo.MilliSleep(2000)
			editorScreenImg := robotgo.CaptureImg()
			// if debugMode {
			// 	go func() {
			// 		gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/face-%d-ID-%v--editor-screen-%d.jpg", currentTs, i, imageId, count), editorScreenImg)
			// 	}()
			// }
			_, _, err := bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/enhancement-%s.png", strings.ToLower(strings.ReplaceAll(enhancements[0].Name, " ", "-"))), editorScreenImg)
			if err != nil {
				if count > 10 {
					break
				}
				continue
			}
			selectedFaceLoaded = true
			break
		}
		// Skip the image if it has not been detected -- Could becasue FaceApp failed to detect the image too
		if !selectedFaceLoaded {
			log.Printf("WARN: [Face %v] No enhancements detected after selection...\n", imageId)
			err = bluestacks.OsBackClick() // Exit back to home screen
			if err != nil {
				log.Fatal("ERROR: ", err.Error())
			}
			continue
		}

		editorScreenImg := robotgo.CaptureImg()

		log.Printf("[Face %v] Starting enhancement...\n", imageId)

		// Ensure that the Female Gender Controls are Activated
		genderSwitchIconCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
			imagePath := "./assets/faceapp/editor-header.png"
			editorHeaderImg, _, err := robotgo.DecodeImg(imagePath)
			if err != nil {
				return Coords{}, fmt.Errorf("%v: %s", err, imagePath)
			}
			gsImagePath := "./assets/faceapp/gender-switch-icon.png"
			genderSwitchIconImg, _, err := robotgo.DecodeImg(gsImagePath)
			if err != nil {
				return Coords{}, fmt.Errorf("%v: %s", err, gsImagePath)
			}
			coords, _, err := bluestacks.GetImageCoordsInImage(editorHeaderImg, editorScreenImg)
			if err != nil {
				return Coords{}, fmt.Errorf("%v: %s", err, imagePath)
			}
			xLandmark := float64(coords.X) / float64(bluestacks.ScreenWidth)
			xPointInImage := xLandmark * float64(editorScreenImg.Bounds().Dx())
			genderSwitchXPointInImage := xPointInImage + float64(editorHeaderImg.Bounds().Dx())/2.0 - float64(genderSwitchIconImg.Bounds().Dx())/2.0
			genderSwitchXLandmark := genderSwitchXPointInImage / float64(editorScreenImg.Bounds().Dx())
			genderSwitchXCoord := int(math.Round(genderSwitchXLandmark * float64(bluestacks.ScreenWidth)))
			return Coords{
				X: genderSwitchXCoord,
				Y: coords.Y,
			}, err
			// return bluestacks.GetImagePathCoordsInImage("./assets/faceapp/gender-switch-icon.png", editorScreenImg)
		}, "editor-gender-switch-icon")
		if err != nil {
			log.Printf("ERROR: Cannot select gender switch icon - %v\n", err.Error())
			continue
		}
		// if debugMode {
		// 	q.Q("Gender Switch Icon Coords: ", genderSwitchIconCoords)
		// }
		bluestacks.MoveClick(genderSwitchIconCoords.X, genderSwitchIconCoords.Y)
		robotgo.MilliSleep(250)
		editorScreenImg = robotgo.CaptureImg()
		genderSwitchOptionCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
			coords, _, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/gender-switch-female-option.png", editorScreenImg)
			return coords, err
		}, "editor-gender-switch-option")
		if err != nil {
			log.Printf("ERROR: Cannot select gender switch option - %v\n", err.Error())
			continue
		}
		// if debugMode {
		// 	q.Q("Gender Switch Icon Coords: ", genderSwitchOptionCoords)
		// }
		bluestacks.MoveClick(genderSwitchOptionCoords.X, genderSwitchOptionCoords.Y)
		robotgo.MilliSleep(250)

		// 5. Run the enhancement process here.

		// 5.1. Determine the enhancements
		// -- 5.1.1. Check if user has beard -- add beard. -- random selection of beard type depending on if mustache/beard
		// -- 5.1.2. Check if user has glasses -- add glasses -- random selection
		// -- 5.1.3. Check if female, and probability for make up -- add make up -- random selection
		// -- 5.1.4. Plus size the person by chance too -- there should be heavier people.
		// 5.2. Iterate and apply the enhancements
		// -- 5.2.1. Select enhancement
		// -- 5.2.2. Wait for the processing text to no longer show
		// -- 5.2.3. Select the Apply text
		// -- 5.2.4. Select the Save text
		// -- 5.2.5. Detect the image inside of the Save Screen
		// -- 5.2.6. Click the back button -- to get back to the Editor

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
					for _, t := range enhancement.Types {
						if t.Name == "Full beard" {
							eType = t
						}
					}
				}
			}
			if !applyEnhancement {
				// Apply probabilty for enhancement
				applyEnhancement = rand.Float64() <= enhancement.Probability
			}
			if !applyEnhancement {
				continue
			}
			// Select the type of enhancement -- // First, Clone and shuffle the enhacements types
			enhancementTypes := enhancement.ShuffleTypes()
			for {
				if len(eType.Name) != 0 {
					break
				}
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
			editorScreenImg := robotgo.CaptureImg()
			log.Printf("Image ID %v - Entering into enhancement %s ... \n", imageId, enhancement.Name)
			eCoords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
				coords, _, err := bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/enhancement-%s.png", strings.ToLower(strings.ReplaceAll(enhancement.Name, " ", "-"))), editorScreenImg)
				return coords, err
			}, fmt.Sprintf("enhancement-%s", enhancement.Name))
			if err != nil {
				log.Printf("ERROR: Cannot select enhancement %s - %v\n", enhancement.Name, err.Error())
				continue
			}
			// if debugMode {
			// 	q.Q("Enhancement Coords: ", enhancement.Name, eCoords)
			// }
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
					coords, _, err := bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/etype-%s-%s.png", strings.ToLower(strings.ReplaceAll(enhancement.Name, " ", "-")), strings.ToLower(strings.ReplaceAll(scrollReferenceEnhancementType.Name, " ", "-"))), editorScreenImg)
					return coords, err
				}, fmt.Sprintf("enhancement-type-%s", scrollReferenceEnhancementType.Name))
				// if debugMode {
				// 	q.Q("Scroll Reference Enhancement Type Coords: ", scrollReferenceEnhancementType.Name, etCoords)
				// }
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
				coords, _, err := bluestacks.GetImagePathCoordsInImage(fmt.Sprintf("./assets/faceapp/etype-%s-%s.png", strings.ToLower(strings.ReplaceAll(enhancement.Name, " ", "-")), strings.ToLower(strings.ReplaceAll(eType.Name, " ", "-"))), editorScreenImg)
				return coords, err
			}, fmt.Sprintf("enhancement-type-%s", eType.Name))
			// if debugMode {
			// 	q.Q("Enhancement Type Coords: ", eType.Name, etCoords)
			// }
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
				coords, _, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/apply.png", editorScreenImg)
				return coords, err
			}, "editor-apply")
			if err != nil {
				log.Fatalf("ERROR: Cannot find Apply text/button - %v\n", err.Error())
				continue
			}
			// if debugMode {
			// 	q.Q("Apply Coords: ", applyCoords)
			// }
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
				coords, _, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/save.png", editorScreenImg)
				return coords, err
			}, "editor-save")
			if err != nil {
				log.Fatalf("ERROR: Cannot find Save text/button - %v\n", err.Error())
				continue
			}
			// if debugMode {
			// 	q.Q("Save Coords: ", saveCoords)
			// }
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
				log.Printf("WARN: [Face %v] Failed to Save.\n", imageId)
				err = bluestacks.ExitScreen(len(enhancementsApplied) > 0) // Exit the enhancement selection screen to the gallery screen
				if err != nil {
					log.Fatal("ERROR: ", err.Error())
				}
				robotgo.MilliSleep(1000)
				continue
			}
			log.Printf("[Face %v] Saved!\n", imageId)
			faceRect := bluestacks.DetectFaces(postSaveImg, 300) // Increase validity integer to prevent detching before & after faces
			// Cache the post-save face detection. This way we can fallback in the case the face detected is not at center of the screen, or if there are no faces detected.
			if len(faceRect) != 1 {
				if len(faceRect) > 1 {
					// This was being hit due to the images inside of then Before & After image.
					log.Printf("WARN: [Face %v] Detected multiple faces after enhancement...\n", imageId)
				} else if len(faceRect) == 0 {
					log.Printf("WARN: [Face %v] Cannot find Detected Enhanced Face...\n", imageId)
				}
				if len(detectedEnhancedFaces) == 0 {
					log.Printf("ERROR: [Face %v] No cached Detected Enhanced Face Coordinates to use...\n", imageId)
					// Use the back button to return to the Home Screen -- Exit the Save Screen and then Editor Screen
					_ = bluestacks.OsBackClick()
					err = bluestacks.OsBackClick()
					if err != nil {
						log.Fatal("ERROR: ", err.Error())
					}
					continue
				} else {
					log.Printf("[Face %v] Using average cached Detected Enhanced Face Coordinates\n", imageId)
					// Determine total rect from previously detected post-save faces
					var totalRect image.Rectangle
					for _, r := range detectedEnhancedFaces {
						totalRect = image.Rectangle{
							Min: image.Point{
								X: r.Min.X + totalRect.Min.X,
								Y: r.Min.Y + totalRect.Min.Y,
							},
							Max: image.Point{
								X: r.Max.X + totalRect.Max.X,
								Y: r.Max.Y + totalRect.Max.Y,
							},
						}
					}
					faceRect = []image.Rectangle{
						image.Rect(totalRect.Min.X/len(detectedEnhancedFaces), totalRect.Min.Y/len(detectedEnhancedFaces), totalRect.Max.X/len(detectedEnhancedFaces), totalRect.Max.Y/len(detectedEnhancedFaces)),
					}
				}
			} else {
				detectedEnhancedFaces = append(detectedEnhancedFaces, faceRect[0])
			}
			// Save detected enhanced face to output directory
			enhancedFaceImg := imaging.Crop(postSaveImg, faceRect[0])
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
		log.Printf("[Face %v] %d enhancements made\n", imageId, len(enhancementsApplied))

		imageIndex = append(imageIndex, IndexedImage{
			Id:                imageId,
			Enhancements:      enhancementsApplied,
			EnhancedImagePath: enhancedFaceImgPath,
		})

		// Use the back button to return to the Home Screen -- Exit the Editor Screen.
		_ = bluestacks.OsBackClick()

		// Hit the Back Button again to reach the Bluestacks Home Screen
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
