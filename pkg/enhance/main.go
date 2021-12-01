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
	"image"
	"image/color"
	"image/jpeg"
	"log"
	"math"
	"os"
	"path"
	"path/filepath"
	"q"
	"strconv"
	"time"

	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
	"github.com/nfnt/resize"
	"github.com/oliamb/cutter"
	"github.com/otiai10/gosseract/v2"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
	"gocv.io/x/gocv"
	"gocv.io/x/gocv/contrib"
)

var (
	// The Root Cli Handler
	rootCmd = &cli.Command{
		Use:   "enhance",
		Short: "Enhance",
		Run:   EnhanceAll,
	}
)

func init() {
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Run the enhancement in debug mode. Will output images to tmp folder.")
	rootCmd.PersistentFlags().StringP("cascade-file", "c", "", "Path to local cascaseFile used for OpenCV FaceDetect Classifier.")
	rootCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	rootCmd.PersistentFlags().StringP("source", "s", "./output/step2", "Path to source image directory where image ids will be deduced.")
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

func setupHashes() []contrib.ImgHashBase {
	var hashes []contrib.ImgHashBase

	hashes = append(hashes, contrib.PHash{})
	hashes = append(hashes, contrib.AverageHash{})
	hashes = append(hashes, contrib.BlockMeanHash{})
	hashes = append(hashes, contrib.BlockMeanHash{Mode: contrib.BlockMeanHashMode1})
	hashes = append(hashes, contrib.ColorMomentHash{})
	// MarrHildreth has default parameters for alpha/scale
	hashes = append(hashes, contrib.NewMarrHildrethHash())
	// RadialVariance has default parameters too
	hashes = append(hashes, contrib.NewRadialVarianceHash())

	return hashes
}

func EnhanceAll(cmd *cli.Command, args []string) {
	var err error

	debugMode, _ := cmd.Flags().GetBool("debug")
	cascadeFile, _ := cmd.Flags().GetString("cascade-file")
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDir, _ := cmd.Flags().GetString("source")
	currentTs := time.Now().Unix()
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

	bluestacks := NewBlueStacks()

	bluestacks.StartOCR()
	defer bluestacks.OCRClient.Close()

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	// Index each face to an output directory
	// var imageIndex []map[string]string
	// Fetch all the images from the source directory
	sourceImagePaths, err := filepath.Glob(path.Join(sourceDir, "/*"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	q.Q(sourceImagePaths)

	screenImg := robotgo.CaptureImg()
	if debugMode {
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-0.jpg", screenImg)
	}

	bluestacks.ScrollUp(50) // Scroll up to ensure that gallery button shows.
	controlCoords, err := bluestacks.GetImagePathCoordsInImage("./assets/faceapp/gallery.png", screenImg)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	bluestacks.MoveClick(controlCoords.X, controlCoords.Y)
	robotgo.MilliSleep(500) // Wait for animation to finish
	screenImg = robotgo.CaptureImg()
	controlCoords, err = bluestacks.GetImagePathCoordsInImage("./assets/faceapp/folder-filter.png", screenImg)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	bluestacks.MoveClick(controlCoords.X, controlCoords.Y)
	robotgo.MilliSleep(500) // Wait for animation to finish
	screenImg = robotgo.CaptureImg()
	sharedFolderCoords, err := bluestacks.GetTextCoordsInImage("SharedFolder", screenImg, gosseract.RIL_WORD)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	bluestacks.MoveClick(sharedFolderCoords.X, sharedFolderCoords.Y)

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
	var faces []image.Rectangle
	for _, r := range rects {
		if r.Dx() > 100 {
			faces = append(faces, r)
		}
	}
	log.Printf("Found %d faces\n", len(faces))

	// TODO: Create a map of original detected faces to the enhanced faces
	// Add to the image index map
	var simHash contrib.AverageHash
	for _, rect := range faces {
		// Run the enhancement process inside of this loop
		// 1. Click on the face to load it
		faceCoords := bluestacks.GetCoords((rect.Min.X+rect.Max.X)/2, (rect.Min.Y+rect.Max.Y)/2, screenImg)
		bluestacks.MoveClick(faceCoords.X, faceCoords.Y)
		// 2. Wait for the face to appear
		count := 0
		var validRects []image.Rectangle
		var detectedScreenImg image.Image
		for {
			count++
			robotgo.MilliSleep(1000)
			sImg := robotgo.CaptureImg()
			sMat, _ := gocv.ImageToMatRGB(sImg)
			defer sMat.Close()
			sRects := classifier.DetectMultiScale(sMat)
			for _, r := range sRects {
				if r.Dx() > 100 {
					validRects = append(validRects, r)
				}
			}
			if len(validRects) > 0 {
				detectedScreenImg = sImg
				break
			} else if count > 10 {
				break
			}
		}
		// Skip the image if it has not been detected -- Could becasue FaceApp failed to detect the image too
		if len(validRects) == 0 {
			continue
		}

		// 3. Once the face is detected, match it against the files in the source directory.
		detectedImg, _ := cutter.Crop(detectedScreenImg, cutter.Config{
			Width:  validRects[0].Dx(),
			Height: validRects[0].Dy(),
			Anchor: image.Point{
				X: validRects[0].Min.X,
				Y: validRects[0].Min.Y,
			},
			Mode: cutter.TopLeft,
		})
		dMat, _ := gocv.ImageToMatRGB(detectedImg)
		if dMat.Empty() {
			log.Fatalln("Cannot load image matrix for face")
		}
		defer dMat.Close()
		dHash := gocv.NewMat()
		defer dHash.Close()
		simHash.Compute(dMat, &dHash)
		if dHash.Empty() {
			log.Println("Cannot compute hash for detected image")
		}

		for _, sourceImagePath := range sourceImagePaths {
			srcMat := gocv.IMRead(sourceImagePath, gocv.IMReadColor)
			if srcMat.Empty() {
				log.Printf("Cannot read image %s\n", sourceImagePath)
			}
			defer srcMat.Close()
			srcHash := gocv.NewMat()
			defer srcHash.Close()
			// image similarity
			simHash.Compute(srcMat, &srcHash)
			if srcHash.Empty() {
				log.Printf("Cannot compute hash for image %s\n", sourceImagePath)
			}

			// compare for similarity; this returns a float64, but the meaning of values is
			// unique to each algorithm.
			similar := simHash.Compare(dHash, srcHash)

			q.Q(sourceImagePath, similar)
		}
	}

	// for i, face := range faces {
	// 	// Run the enhancement process inside of this loop
	// 	count := len(imageIndex) + i
	// 	detectedImg := image.NewRGBA(face)
	// 	detectedPath := path.Join(outputDir, "detected-"+strconv.Itoa(count)+".jpeg")
	// 	f, err := os.Create(detectedPath)
	// 	if err != nil {
	// 		log.Fatal("ERROR: ", err.Error())
	// 	}
	// 	// jpeg.Encode(f, , &jpeg.Options{
	// 	// 	Quality: 90,
	// 	// })

	// 	imageMap := map[string]string{
	// 		"detected": detectedPath,
	// 		// "enhanced": enhancedPath,
	// 	}
	// 	imageIndex = append(imageIndex, imageMap)
	// 	f.Close()
	// }

	if debugMode {
		// draw a rectangle around each face on the original image,
		// along with text identifing as "Human"
		for _, r := range faces {
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

func Enhance(cmd *cli.Command, args []string) {
	var err error
	searchImage := "./output/step2/1636551195604/46.jpeg"
	// searchImage := "./tmp/46.png"
	// searchImage := "./tmp/46-2.png"
	// searchImage := "./tmp/46-3.png"
	// searchImage := "./tmp/46-4.png"
	// searchImage := "./tmp/46-5.png"
	searchImageId := 46
	simageId := strconv.Itoa(searchImageId)
	debugMode, _ := cmd.Flags().GetBool("debug")

	currentTs := time.Now().Unix()
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

	bluestacks := NewBlueStacks()
	bluestacks.StartOCR()
	defer bluestacks.OCRClient.Close()

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	screenImg := robotgo.CaptureImg()
	img, _, err := robotgo.DecodeImg(searchImage)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}
	if debugMode {
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/target-image.jpg", img)
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-0.jpg", screenImg)
	}

	// bounds := bluestacks.GetBounds()
	// q.Q(bounds)

	buf := new(bytes.Buffer)
	err = jpeg.Encode(buf, screenImg, nil)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}
	screenImgBytes := buf.Bytes()
	err = bluestacks.OCRClient.SetImageFromBytes(screenImgBytes)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}
	log.Println("Search for file of id " + simageId + "...")

	// Produce multiple sizes for the search image
	// var searchImgs []image.Image
	for i := 1; i <= 10; i++ {
		sImg := resize.Resize(uint(math.Round(float64(img.Bounds().Dx())/float64(i))), 0, img, resize.Lanczos3)
		// searchImgs = append(searchImgs, newImg)
		q.Q(i, sImg.Bounds().Dx(), sImg.Bounds().Dy())
		q.Q(gcv.FindAllImg(sImg, screenImg, 0.6))
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/target-image-resize"+strconv.Itoa(i)+".jpg", sImg)

		// cImg := gocv.Canny()
	}

	// https://stackoverflow.com/questions/50641197/opencv-fails-to-match-template-with-imagematchtemplate
	// for i := 1; i <= 10; i++ {
	// 	sourceImg := resize.Resize(uint(math.Round(float64(img.Bounds().Dx())*float64(i/10+1))), 0, screenImg, resize.Lanczos3)
	// 	// searchImgs = append(searchImgs, newImg)
	// 	q.Q(i, sourceImg.Bounds().Dx(), sourceImg.Bounds().Dy())
	// 	q.Q(gcv.FindAllImg(img, sourceImg))
	// 	gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/source-image-resize"+strconv.Itoa(i)+".jpg", sourceImg)
	// }

	// mediaManagerImg, _, err := robotgo.DecodeImg("./assets/opencv/media-manager.png")
	// if err != nil {
	// 	log.Fatalln("ERROR:", err)
	// }
	// mediaManagerPos := gcv.FindAllImg(mediaManagerImg, screenImg)
	// mediaManagerLandmark := map[string]float64{
	// 	"X": float64(mediaManagerPos[0].Middle.X) / float64(screenImg.Bounds().Dx()),
	// 	"Y": float64(mediaManagerPos[0].Middle.Y) / float64(screenImg.Bounds().Dy()),
	// }
	// mediaManagerCoords := map[string]int{
	// 	"X": int(math.Round(mediaManagerLandmark["X"] * float64(bluestacks.ScreenWidth))),
	// 	"Y": int(math.Round(mediaManagerLandmark["Y"] * float64(bluestacks.ScreenHeight))),
	// }
	// q.Q(mediaManagerLandmark, mediaManagerCoords)
	// robotgo.Move(mediaManagerCoords["X"], mediaManagerCoords["Y"]) // TODO: Mouse Move not working...
	// robotgo.Click()
	// err = bluestacks.ShowImportedFiles()
	// if err != nil {
	// 	log.Fatalln("ERROR:", err)
	// }

	// err := bluestacks.OpenFile()

	// bluestacks.ShowFaceApp()

	log.Println("Finding image in screen: ")
	count := 1
	robotgo.MouseSleep = 100
	var res []gcv.Result
	// We need a condition for identifying the end and start of the scroll.
	// -- We can solve this by taking a screenshot, scrolling and then checking if there is a difference in the screenshots.
	// scrollDirection := "down"
	// if !bluestacks.CanSrollDown(100) {
	// 	scrollDirection = "up"
	// }
	for {
		countStr := strconv.Itoa(count)
		log.Println("Attempt " + countStr + " ...")

		screenImg = robotgo.CaptureImg()
		// res = gcv.FindAllImg(img, screenImg)
		if debugMode {
			gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-"+countStr+".jpg", screenImg)
		}

		if len(res) > 0 {
			log.Println("Image has been found!")
			break
		}

		// preImg := robotgo.CaptureImg()
		// if scrollDirection == "down" {
		// 	bluestacks.ScrollDown(150)
		// } else if scrollDirection == "up" {
		// 	bluestacks.ScrollUp(150)
		// }
		// robotgo.MilliSleep(500)
		// postImg := robotgo.CaptureImg()
		// // This following appraoch does a direct image comparison rather than an OpenCV search -- so it's more reliable for the use case.
		// preHash, preImgSize := images.Hash(preImg)
		// postHash, postImgSize := images.Hash(postImg)
		// if images.Similar(preHash, postHash, preImgSize, postImgSize) {
		// 	gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/pre.jpg", preImg)
		// 	gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/post.jpg", postImg)
		// 	log.Println("Scroll limit has been reach")
		// 	break
		// }
		break

		robotgo.MilliSleep(1000) // Delay each iteration with a buffer
		count++
	}
	// We now have a result.
	log.Println(res)

	err = beeep.Notify("Automatically Animated", "Enhancement script is complete", "")
	if err != nil {
		log.Fatal("ERROR:", err)
	}
}
