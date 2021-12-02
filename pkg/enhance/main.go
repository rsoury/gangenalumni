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
	"os"
	"path"
	"path/filepath"
	"q"
	"strconv"
	"time"

	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
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
	currentTs = time.Now().Unix()
	debugMode = false
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

	debugMode, _ = cmd.Flags().GetBool("debug")
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
		// var detectedScreenImg image.Image
		for {
			count++
			robotgo.MilliSleep(1000)
			sImg := robotgo.CaptureImg()
			sMat, _ := gocv.ImageToMatRGB(sImg)
			defer sMat.Close()
			// // We should attempt to zoom out before running the detection... as the face is zoomed in by default
			robotgo.MilliSleep(1000)
			sRects := classifier.DetectMultiScale(sMat)
			for _, r := range sRects {
				if r.Dx() > 100 {
					validRects = append(validRects, r)
				}
			}
			// if len(validRects) > 0 {
			// 	detectedScreenImg = sImg
			// 	break
			// } else if count > 10 {
			// 	break
			// }
			if len(validRects) > 0 || count > 10 {
				break
			}
		}
		// Skip the image if it has not been detected -- Could becasue FaceApp failed to detect the image too
		if len(validRects) == 0 {
			continue
		}

		// 3. Once the face is detected, match it against the files in the source directory.
		// -- Use the face that was detected before the click to enhance -- This prevents the zoom out requirement
		detectedImg, _ := cutter.Crop(screenImg, cutter.Config{
			Width:  rect.Dx(),
			Height: rect.Dy(),
			Anchor: image.Point{
				X: rect.Min.X,
				Y: rect.Min.Y,
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

			q.Q(sourceImagePath, similar) // TODO: Test to find out if the actual image actually returns the highest similarity score.
		}
	}

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
