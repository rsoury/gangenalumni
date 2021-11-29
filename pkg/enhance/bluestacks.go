package main

import (
	"log"
	"q"

	"github.com/go-vgo/robotgo"
	"github.com/otiai10/gosseract/v2"
	"github.com/vcaesar/gcv"
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

// func (b *BlueStacks) CaptureApp() {
// 	bounds := b.GetBounds()
// 	robotgo.CaptureImg()
// }

func (b *BlueStacks) GetTextBounds(text string, level gosseract.PageIteratorLevel) (gosseract.BoundingBox, error) {
	boxes, err := b.OCRClient.GetBoundingBoxes(level)
	if err != nil {
		return gosseract.BoundingBox{}, err
	}

	for _, box := range boxes {
		q.Q(box.Word)
	}

	return gosseract.BoundingBox{}, nil
}

func (b *BlueStacks) ShowImportedFiles() error {
	box, err := b.GetTextBounds("Media Manager", gosseract.RIL_BLOCK)
	q.Q(box)

	return err
}
