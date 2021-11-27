package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"runtime"

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
		fmt.Errorf(err.Error())
	}
	fmt.Println(fpid)
	err = robotgo.ActivePID(fpid[0])
	if err != nil {
		log.Fatal(err)
	}
	osName := runtime.GOOS

	log.Println("Start enhancement...")

	image, _ := cmd.Flags().GetString("image")

	if _, err := os.Stat(image); errors.Is(err, os.ErrNotExist) {
		log.Fatal("ERROR: Image does not exist")
	}

	screenImg := robotgo.CaptureImg()
	img, _, err := robotgo.DecodeImg(image)
	if err != nil {
		log.Fatal(err)
	}

	log.Println("gcv find image: ")
	res := gcv.FindAllImg(img, screenImg)
	yScroll := 250
	if osName == "darwin" {
		yScroll = -1 * yScroll // Scroll up for Mac to go down
	}
	for len(res) == 0 {
		robotgo.Scroll(0, yScroll)
		screenImg = robotgo.CaptureImg()
		res = gcv.FindAllImg(img, screenImg)
	}
	// We now have a result.
	log.Println(res)
}
