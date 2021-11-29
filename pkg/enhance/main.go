/*
	This binary is desiged to accept an image and perform enhancements on said image.
*/

package main

import (
	"bytes"
	"image/jpeg"
	"log"
	"os"
	"q"
	"strconv"
	"time"

	"github.com/gen2brain/beeep"
	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
)

var (
	// The Root Cli Handler
	rootCmd = &cli.Command{
		Use:   "enhance",
		Short: "Enhance",
		Run:   Enhance,
	}
)

func init() {
	rootCmd.PersistentFlags().StringP("image", "i", "", "Image that will be matched with FaceApp Library")
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Run the enhancement in debug mode. Will output images to tmp folder.")
	_ = rootCmd.MarkFlagRequired("image")
}

func main() {
	// Run the program
	if err := rootCmd.Execute(); err != nil {
		log.Fatalln("ERROR:", err)
	}
}

func Enhance(cmd *cli.Command, args []string) {
	var err error
	image := "./output/step2/1636551195604/46.jpeg"
	// image := "./tmp/46.png"
	// image := "./tmp/46-2.png"
	// image := "./tmp/46-3.png"
	imageId := 46
	simageId := strconv.Itoa(imageId)
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
	img, _, err := robotgo.DecodeImg(image)
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

	q.Q(gcv.FindAllImg(img, screenImg))

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
	err = bluestacks.ShowImportedFiles()
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

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
