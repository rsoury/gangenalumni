package main

import (
	"image"
	"image/color"
	"math"
	"os"
	"path"
	"q"
	"testing"

	"github.com/go-vgo/robotgo"
	"gocv.io/x/gocv"
)

func TestGetImagePathCoordsInImage(t *testing.T) {
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

	// bluestacks.StartOCR()
	// defer bluestacks.OCRClient.Close()
	img, _, err := robotgo.DecodeImg(path.Join(cwd, "./test/editor-screen-Eyebrows--1638706561.jpg"))
	if err != nil {
		t.Fatal(err)
	}

	// nImg, _ := intensifyTextInImage(img)

	// if gocv.IMWrite(path.Join(cwd, "./tmp/test/TestGetTextCoordsInImage.jpg"), iMat) {
	// 	t.Log("Successfully wrote image to file")
	// } else {
	// 	t.Log("Failed to write image to file")
	// }
	// if gcv.ImgWrite(path.Join(cwd, "./tmp/test/TestGetTextCoordsInImage.jpg"), nImg) {
	// 	t.Log("Successfully wrote image to file")
	// } else {
	// 	t.Log("Failed to write image to file")
	// }

	// coords, err := bluestacks.GetTextCoordsInImage("Foundation", nImg)
	coords1, err := bluestacks.GetImagePathCoordsInImage(path.Join(cwd, "./assets/faceapp/etype-makeup-foundation.png"), img)
	if err != nil {
		t.Fatal(err.Error())
	}
	q.Q(coords1, err)
	t.Log(coords1)
	coords2, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
		return bluestacks.GetImagePathCoordsInImage(path.Join(cwd, "./assets/faceapp/etype-makeup-contouring.png"), img)
	}, "hello-world")
	if err != nil {
		t.Fatal(err.Error())
	}
	q.Q(coords2, err)
	t.Log(coords2)

	coordsArr := []Coords{coords1, coords2}

	// color for the rect when faces detected
	blue := color.RGBA{0, 0, 255, 0}
	// draw a rectangle around each face on the original image,
	// along with text identifing as "Human"
	iMat, _ := gocv.ImageToMatRGB(img)
	defer iMat.Close()
	for _, coords := range coordsArr {
		imageCoords := getCoordsInImage(coords.X, coords.Y, bluestacks.ScreenWidth, bluestacks.ScreenHeight, img)
		rect := image.Rect(imageCoords.X-10, imageCoords.Y-10, imageCoords.X+10, imageCoords.Y+10)
		gocv.Rectangle(&iMat, rect, blue, 3)
	}

	if gocv.IMWrite(path.Join(cwd, "./tmp/test/TestGetImagePathCoordsInImage.jpg"), iMat) {
		t.Log("Successfully created opencv image\n")
	} else {
		t.Log("Failed to create opencv image\n")
	}
}

func getCoordsInImage(x, y, screenWidth, screenHeight int, img image.Image) Coords {
	landmark := map[string]float64{
		"X": float64(x) / float64(screenWidth),
		"Y": float64(y) / float64(screenHeight),
	}
	coords := Coords{
		X: int(math.Round(landmark["X"] * float64(img.Bounds().Dx()))),
		Y: int(math.Round(landmark["Y"] * float64(img.Bounds().Dy()))),
	}

	return coords
}
