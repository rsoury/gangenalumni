package main

import (
	"os"
	"path"
	"q"
	"testing"

	"github.com/go-vgo/robotgo"
	"gocv.io/x/gocv"
)

func TestGetTextCoordsInImage(t *testing.T) {
	// Setup Bluestacks
	cwd, _ := os.Getwd()
	cwd = path.Join(cwd, "../../")
	screenWidth, screenHeight := robotgo.GetScreenSize()
	bluestacks := &BlueStacks{
		ScreenWidth:  screenWidth,
		ScreenHeight: screenHeight,
		CenterCoords: &Coords{
			X: screenWidth / 2,
			Y: screenHeight / 2,
		},
	}

	bluestacks.StartOCR()
	defer bluestacks.OCRClient.Close()
	img, _, err := robotgo.DecodeImg(path.Join(cwd, "./test/editor-screen-Eyebrows--1638706561.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	// img := robotgo.CaptureImg()

	iMat, _ := gocv.ImageToMatRGB(img)
	// Seems greyscaling the image help with OCR.
	gocv.CvtColor(iMat, &iMat, gocv.ColorBGRToGray)

	mImg, _ := iMat.ToImage()

	if gocv.IMWrite(path.Join(cwd, "./tmp/test/TestGetTextCoordsInImage.jpg"), iMat) {
		t.Log("Successfully wrote image to file")
	} else {
		t.Log("Failed to write image to file")
	}

	coords, err := bluestacks.GetTextCoordsInImage("Contouring", mImg)
	if err != nil {
		t.Fatal(err.Error())
	}
	q.Q(coords, err)
	t.Log(coords)
}
