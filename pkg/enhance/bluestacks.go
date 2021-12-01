package main

import (
	"image"
	"log"
	"math"
	"strings"

	"github.com/go-vgo/robotgo"
	"github.com/otiai10/gosseract/v2"
	"github.com/vcaesar/gcv"
	"gocv.io/x/gocv"
)

type Coords struct {
	X int
	Y int
}

type Bounds struct {
	Top    int
	Left   int
	Width  int
	Height int
}

type BlueStacks struct {
	OCRClient    *gosseract.Client
	ActivePID    int32
	ScreenWidth  int
	ScreenHeight int
	CenterCoords *Coords
}

func NewBlueStacks() *BlueStacks {
	processName := "BlueStacks"
	fpid, err := robotgo.FindIds(processName)
	if err != nil {
		log.Fatal(err)
	}
	log.Println(fpid)
	// Ensure that the main BlueStacks pid is used
	var activePid int32
	for _, pid := range fpid {
		name, err := robotgo.FindName(pid)
		if err != nil {
			log.Fatal(err)
		}
		if name == processName {
			activePid = pid
			break
		}
	}
	err = robotgo.ActivePID(activePid)
	if err != nil {
		log.Fatal(err)
	}

	// windowX, windowY, windowWidth, windowHeight := robotgo.GetBounds(fpid[0])
	//* Seems that GetBounds isn't returning the coordinates that are actually correct...
	// Instead, we're simple going to use the screensize to set the mouse to the center of the screen.
	screenWidth, screenHeight := robotgo.GetScreenSize()

	bluestacks := &BlueStacks{
		ActivePID:    activePid,
		ScreenWidth:  screenWidth,
		ScreenHeight: screenHeight,
		CenterCoords: &Coords{
			X: screenWidth / 2,
			Y: screenHeight / 2,
		},
	}

	return bluestacks
}

func (b *BlueStacks) StartOCR() {
	b.OCRClient = gosseract.NewClient()
}

func (b *BlueStacks) scroll(scrollDirection string, scrollBy int) {
	if scrollDirection != "down" && scrollDirection != "up" {
		scrollDirection = "down"
	}
	if scrollDirection == "down" {
		scrollBy = -scrollBy
	}

	// // Scroll twice because thre screensize isn't big enough
	robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y+scrollBy)
	// robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	// robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y+scrollBy)
}

func (b *BlueStacks) ScrollUp(scrollBy int) {
	b.scroll("up", scrollBy)
}

func (b *BlueStacks) ScrollDown(scrollBy int) {
	b.scroll("down", scrollBy)
}

// Private reusable function to determine if there is anymore scroll capability.
func (b *BlueStacks) canScroll(scrollBy int) bool {
	preImg := robotgo.CaptureImg()
	robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y+scrollBy)
	robotgo.MilliSleep(500)
	postImg := robotgo.CaptureImg()
	// Revert the scroll after check
	robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y-scrollBy)
	robotgo.MilliSleep(500)

	res := gcv.FindAllImg(postImg, preImg)
	// if there are results, it means that the search found the pre & post images are the same -- which means that the scroll did not affect the visual output
	return len(res) == 0
}

func (b *BlueStacks) CanSrollDown(scrollBy int) bool {
	return b.canScroll(-scrollBy)
}

func (b *BlueStacks) CanSrollUp(scrollBy int) bool {
	return b.canScroll(scrollBy)
}

// Get screen coords and width and height of the bluestacks app
func (b *BlueStacks) GetBounds() Bounds {
	left, top, width, height := robotgo.GetBounds(b.ActivePID)
	return Bounds{
		Left:   left,
		Top:    top,
		Width:  width,
		Height: height,
	}
}

func (b *BlueStacks) GetTextCoordsInImage(text string, img image.Image, level gosseract.PageIteratorLevel) (Coords, error) {
	screenForOCRMat, _ := gocv.ImageToMatRGB(img)
	defer screenForOCRMat.Close()
	// Seems greyscaling the image helps heaps.
	gocv.CvtColor(screenForOCRMat, &screenForOCRMat, gocv.ColorBGRAToGray)
	screenForOCR, _ := screenForOCRMat.ToImage()
	screenBytes, err := ImageToBytes(screenForOCR)
	if err != nil {
		log.Fatal(err.Error())
	}
	_ = b.OCRClient.SetImageFromBytes(screenBytes)

	boxes, err := b.OCRClient.GetBoundingBoxes(level)
	if err != nil {
		return Coords{}, err
	}

	var result Coords
	for _, box := range boxes {
		if strings.Contains(box.Word, text) && box.Confidence > 80 {
			result = b.GetCoords((box.Box.Min.X+box.Box.Max.X)/2, (box.Box.Min.Y+box.Box.Max.Y)/2, img)
			break
		}
	}

	return result, nil
}

func (b *BlueStacks) GetCoordsFromCV(cvResult gcv.Result, screenImg image.Image) Coords {
	return b.GetCoords(cvResult.Middle.X, cvResult.Middle.Y, screenImg)
}

func (b *BlueStacks) GetCoords(x, y int, screenImg image.Image) Coords {
	landmark := map[string]float64{
		"X": float64(x) / float64(screenImg.Bounds().Dx()),
		"Y": float64(y) / float64(screenImg.Bounds().Dy()),
	}
	coords := Coords{
		X: int(math.Round(landmark["X"] * float64(b.ScreenWidth))),
		Y: int(math.Round(landmark["Y"] * float64(b.ScreenHeight))),
	}

	return coords
}
