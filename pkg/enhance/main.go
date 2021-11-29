/*
	This binary is desiged to accept an image and perform enhancements on said image.
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
	"q"
	"strconv"
	"time"

	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
	"github.com/nfnt/resize"
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
)

func init() {
	rootCmd.PersistentFlags().StringP("image", "i", "", "Image that will be matched with FaceApp Library")
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Run the enhancement in debug mode. Will output images to tmp folder.")
	rootCmd.PersistentFlags().StringP("cascade-file", "c", "", "Path to local cascaseFile used for OpenCV FaceDetect Classifier")
	_ = rootCmd.MarkFlagRequired("image")
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

	debugMode, _ := cmd.Flags().GetBool("debug")
	cascadeFile, _ := cmd.Flags().GetString("cascade-file")
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
	if debugMode {
		gcv.ImgWrite("./tmp/enhance-debug/"+currentTsStr+"/screen-0.jpg", screenImg)
	}

	// galleryControlImg, _, _ := robotgo.DecodeImg("./assets/faceapp/gallery.png")
	// galleryRes := gcv.FindAllImg(galleryControlImg, screenImg)
	// if len(galleryRes) == 0 {
	// 	log.Fatal("ERROR: Cannot find the FaceApp Gallery Control")
	// }
	// galleryCoords := bluestacks.GetCoordsFromCV(galleryRes[0], screenImg)
	// robotgo.MoveClick(galleryCoords.X, galleryCoords.Y)
	// robotgo.MilliSleep(500) // Wait for animation to finish
	// galleryScreenImg := robotgo.CaptureImg()
	// folderFilterControlImg, _, _ := robotgo.DecodeImg("./assets/faceapp/folder-filter.png")
	// folderFilterRes := gcv.FindAllImg(folderFilterControlImg, galleryControlImg)
	// if len(folderFilterRes) == 0 {
	// 	log.Fatal("ERROR: Cannot find the FaceApp Folder Filter Control")
	// }
	// folderFilterCoords := bluestacks.GetCoordsFromCV(folderFilterRes[0], galleryScreenImg)
	// robotgo.MoveClick(folderFilterCoords.X, folderFilterCoords.Y)
	// robotgo.MilliSleep(500) // Wait for animation to finish
	// openFilterScreenImg := robotgo.CaptureImg()

	// TODO: Don't spend too much time -- but try get this OCR to work better...
	screenBytes, err := ImageToBytes(screenImg)
	if err != nil {
		log.Fatal(err.Error())
	}
	_ = bluestacks.OCRClient.SetImageFromBytes(screenBytes)
	boxes, err := bluestacks.GetTextBounds("SharedFolder", gosseract.RIL_TEXTLINE)
	if err != nil {
		log.Fatal("ERROR: Cannot find the FaceApp SharedFolder Text using OCR", err.Error())
	}
	q.Q(boxes)

	// prepare image matrix
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

	// draw a rectangle around each face on the original image,
	// along with text identifing as "Human"
	for _, r := range faces {
		gocv.Rectangle(&screenMat, r, blue, 3)

		size := gocv.GetTextSize("Human", gocv.FontHersheyPlain, 1.2, 2)
		pt := image.Pt(r.Min.X+(r.Min.X/2)-(size.X/2), r.Min.Y-2)
		gocv.PutText(&screenMat, "Human", pt, gocv.FontHersheyPlain, 1.2, blue, 2)
	}

	if debugMode {
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
