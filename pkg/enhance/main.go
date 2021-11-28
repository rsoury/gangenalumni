/*
	This binary is desiged to accept an image and perform enhancements on said image.
*/

package main

import (
	"errors"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"time"

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
	_ = rootCmd.MarkFlagRequired("image")
}

func main() {
	// Run the program
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "%s\n", err.Error())
		os.Exit(1)
	}
}

func Enhance(cmd *cli.Command, args []string) {
	fpid, err := robotgo.FindIds("BlueStacks")
	if err != nil {
		_ = fmt.Errorf(err.Error())
	}
	fmt.Println(fpid)
	osName := runtime.GOOS
	currentTs := time.Now().Unix()
	currentTsStr := strconv.FormatInt(currentTs, 10)
	err = os.Mkdir("./tmp/"+currentTsStr, 0755) // Create tmp dir for this debug dump
	if err != nil {
		_ = fmt.Errorf(err.Error())
	}
	err = robotgo.ActivePID(fpid[0])
	if err != nil {
		_ = fmt.Errorf(err.Error())
	}
	// windowX, windowY, windowWidth, windowHeight := robotgo.GetBounds(fpid[0])
	//* Seems that GetBounds isn't returning the coordinates that are actually correct...
	// Instead, we're simple going to use the screensize to set the mouse to the center of the screen.
	screenWidth, screenHeight := robotgo.GetScreenSize()

	// q.Q(map[string]int{
	// 	"handle":       robotgo.GetHandle(),
	// 	"screenWidth":  screenWidth,
	// 	"screenHeight": screenHeight,
	// 	"X":            windowX,
	// 	"Y":            windowY,
	// 	"width":        windowWidth,
	// 	"height":       windowHeight,
	// })

	fmt.Println("Start enhancement...")

	image, _ := cmd.Flags().GetString("image")

	if _, err := os.Stat(image); errors.Is(err, os.ErrNotExist) {
		_ = fmt.Errorf("ERROR: Image does not exist")
	}

	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.

	screenImg := robotgo.CaptureImg()
	img, _, err := robotgo.DecodeImg(image)
	if err != nil {
		_ = fmt.Errorf(err.Error())
	}
	gcv.ImgWrite("./tmp/"+currentTsStr+"/target-image.jpg", img)
	gcv.ImgWrite("./tmp/"+currentTsStr+"/screen-0.jpg", screenImg)

	fmt.Println("gcv find image: ")
	res := gcv.FindAllImg(img, screenImg)
	yScroll := 480
	if osName == "darwin" {
		yScroll = -1 * yScroll // Scroll up for Mac to go down
	}
	count := 1
	robotgo.MouseSleep = 100
	centerCoordX := screenWidth / 2
	centerCoordY := screenHeight / 2
	for len(res) == 0 {
		countStr := strconv.Itoa(count)
		// requires that we set the mouse position first.
		// robotgo.Move(windowX+10, windowY+250)
		robotgo.Move(centerCoordX, centerCoordY)
		// robotgo.Scroll(0, yScroll) //* Scrolling does not work on the bluestacks vm
		// robotgo.ScrollRelative(0, yScroll)
		robotgo.DragSmooth(centerCoordX, centerCoordY-200)
		robotgo.Move(centerCoordX, centerCoordY)
		robotgo.DragSmooth(centerCoordX, centerCoordY-200)

		time.Sleep(1 * time.Second) // Delay each iteration with a buffer

		screenImg = robotgo.CaptureImg()
		res = gcv.FindAllImg(img, screenImg)
		gcv.ImgWrite("./tmp/"+currentTsStr+"/screen-"+countStr+".jpg", screenImg)
		fmt.Println("Scrolling attempt " + countStr)
		count++
	}
	// We now have a result.
	fmt.Println(res)
}
