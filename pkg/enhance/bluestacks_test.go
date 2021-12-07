package main

import (
	"fmt"
	"image"
	"image/color"
	"math"
	"os"
	"path"
	"path/filepath"
	"q"
	"strings"
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
	imagePaths := make(map[string][]string)
	assets, _ := filepath.Glob(path.Join(cwd, "./assets/faceapp/*.png"))
	enhancementAssets := []string{}
	enhancementMakeupAssets := []string{}
	for _, asset := range assets {
		if strings.Contains(path.Base(asset), "enhancement-") {
			enhancementAssets = append(enhancementAssets, asset)
		}
		if strings.Contains(path.Base(asset), "etype-makeup-") {
			enhancementMakeupAssets = append(enhancementMakeupAssets, asset)
		}
	}
	imagePaths[path.Join(cwd, "./test/editor-screen-Eyebrows--1638706561.jpg")] = enhancementMakeupAssets
	imagePaths[path.Join(cwd, "./test/editor-screen-Petite Goatee--1638866689.jpg")] = enhancementAssets

	// q.Q(imagePaths)

	for ePath, eTypePaths := range imagePaths {
		t.Logf("Processing image path %v\n", ePath)
		img, _, err := robotgo.DecodeImg(ePath)
		if err != nil {
			t.Fatal(err)
		}

		// color for the rect when faces detected
		blue := color.RGBA{0, 0, 255, 0}
		// draw a rectangle around each face on the original image,
		// along with text identifing as "Human"
		iMat, _ := gocv.ImageToMatRGB(img)
		defer iMat.Close()
		for _, eTypePath := range eTypePaths {
			t.Logf("Finding image path: %v\n", eTypePath)
			coords, err := bluestacks.GetCoordsWithCache(func() (Coords, error) {
				return bluestacks.GetImagePathCoordsInImage(eTypePath, img)
			}, eTypePath)
			if err != nil {
				t.Errorf("Cannot find image inside of processing image: %v\n", err.Error())
				continue
			}
			q.Q(coords, err)
			t.Log(coords)

			imageCoords := getCoordsInImage(coords.X, coords.Y, bluestacks.ScreenWidth, bluestacks.ScreenHeight, img)
			rect := image.Rect(imageCoords.X-10, imageCoords.Y-10, imageCoords.X+10, imageCoords.Y+10)
			gocv.Rectangle(&iMat, rect, blue, 3)
			text := strings.ReplaceAll((strings.ReplaceAll(path.Base(eTypePath), "enhancement-", "")), "etype-makeup-", "")
			text = text[0 : len(text)-len(filepath.Ext(text))]
			size := gocv.GetTextSize(text, gocv.FontHersheyPlain, 1.2, 2)
			pt := image.Pt(imageCoords.X-(size.X/2), imageCoords.Y-(size.Y)-10)
			gocv.PutText(&iMat, text, pt, gocv.FontHersheyPlain, 1.2, blue, 2)
		}

		if gocv.IMWrite(path.Join(cwd, fmt.Sprintf("./tmp/test/TestGetImagePathCoordsInImage-%s.jpg", path.Base(ePath))), iMat) {
			t.Logf("Successfully created opencv image for image path %v\n", ePath)
		} else {
			t.Logf("Failed to create opencv image for image path %v\n", ePath)
		}
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
