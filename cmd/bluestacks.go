package main

import (
	"errors"
	"fmt"
	"image"
	"log"
	"math"

	"github.com/disintegration/imaging"
	"github.com/go-vgo/robotgo"
	"github.com/vcaesar/gcv"
	"github.com/vitali-fedulov/images/v2"
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
	ActivePID      int32
	ScreenWidth    int
	ScreenHeight   int
	CenterCoords   *Coords
	FaceClassifier gocv.CascadeClassifier
}

type CVResult struct {
	Confidence  float32
	Point       image.Point
	SearchImage image.Image
	SourceImage image.Image
}

var (
	coordsCache = map[string]Coords{}
)

func init() {
	robotgo.KeySleep = 100
	robotgo.MouseSleep = 100
}

func NewBlueStacks() *BlueStacks {
	processName := "BlueStacks"
	fpid, err := robotgo.FindIds(processName)
	if err != nil {
		log.Fatal("ERROR:", err.Error())
	}
	if len(fpid) == 0 {
		log.Fatal("ERROR: BlueStacks is not running.")
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

func (b *BlueStacks) LoadFaceClassifier(cascadeFile string) error {
	// load classifier to recognize faces
	b.FaceClassifier = gocv.NewCascadeClassifier()

	if !b.FaceClassifier.Load(cascadeFile) {
		return fmt.Errorf("Error reading cascade file: %v\n", cascadeFile)
	}

	return nil
}

func (b *BlueStacks) MoveClick(x, y int) {
	robotgo.Move(x, y)
	robotgo.MilliSleep(100)
	robotgo.Click()
}

func (b *BlueStacks) scroll(scrollBy int) {
	robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	robotgo.MilliSleep(100)
	// If the scrollBy integer is small enough, Bluestacks will simply register the micro drag as a tap/click
	if scrollBy < 50 {
		scrollBy = 50
	}
	robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y+scrollBy)
}

func (b *BlueStacks) ScrollUp(scrollBy int) {
	b.scroll(scrollBy)
}

func (b *BlueStacks) ScrollDown(scrollBy int) {
	b.scroll(-scrollBy)
}

// Private reusable function to determine if there is anymore scroll capability.
func (b *BlueStacks) canScroll(scrollBy int) bool {
	// Prevent Drags from clicking.
	if scrollBy < 50 {
		scrollBy = 50
	}

	preImg := robotgo.CaptureImg()
	robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y+scrollBy)
	robotgo.MilliSleep(500)
	postImg := robotgo.CaptureImg()
	// Revert the scroll after check
	robotgo.Move(b.CenterCoords.X, b.CenterCoords.Y)
	robotgo.DragSmooth(b.CenterCoords.X, b.CenterCoords.Y-scrollBy)
	robotgo.MilliSleep(500)

	// res := gcv.FindAllImg(postImg, preImg)
	// Use an image similarity comparison instead
	// Calculate hashes and image sizes.
	hashA, imgSizeA := images.Hash(preImg)
	hashB, imgSizeB := images.Hash(postImg)

	// Image comparison.
	return !images.Similar(hashA, hashB, imgSizeA, imgSizeB)
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

// We have a process of resizing the search image to determine the result with the best confidence.
func (b *BlueStacks) GetImageCoordsInImage(searchImg, sourceImg image.Image) (Coords, float32, error) {
	// Produce multiple sizes for the search image
	var res CVResult
	var sourceImgResizeCache [10]*image.Image
	for x := 0; x < 4; x++ {
		resizeSearchWidth := int(math.Round(float64(searchImg.Bounds().Dx()) * (1.0 - float64(x)/10.0)))
		rSearchImg := imaging.Resize(sourceImg, resizeSearchWidth, 0, imaging.Lanczos)
		searchMat, _ := gocv.ImageToMatRGB(searchImg)
		defer searchMat.Close()

		for i := 0; i < 10; i++ {
			var rImg image.Image
			if sourceImgResizeCache[i] == nil {
				resizeWidth := int(math.Round(float64(sourceImg.Bounds().Dx()) * (1.0 - float64(i)/10.0)))
				rImg = imaging.Resize(sourceImg, resizeWidth, 0, imaging.Lanczos)
				sourceImgResizeCache[i] = &rImg
			} else {
				rImg = *sourceImgResizeCache[i]
			}
			// log.Printf("Resizing image for width %d\n", resizeWidth)
			// q.Q(i, resizeWidth, rImg.Bounds().Dx())
			if rImg.Bounds().Dx() <= rSearchImg.Bounds().Dx() || rImg.Bounds().Dy() <= rSearchImg.Bounds().Dy() {
				// log.Printf("Source image is smaller than search image - Search: %v,%v , Source: %v,%v \n", rImg.Bounds().Dx(), rImg.Bounds().Dy(), searchImg.Bounds().Dx(), searchImg.Bounds().Dy())
				break // Break the loop if the source image resize becomes smaller than the search image.
			}
			// Then process the results to determine the most common coordinate location on the sourceImg
			srcMat, _ := gocv.ImageToMatRGB(rImg)
			defer srcMat.Close()
			if debugMode {
				gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/screen-resized-%d.jpg", currentTs, i), rImg)
			}
			_, confidence, _, topLeftPoint := gcv.FindImgMat(searchMat, srcMat)

			r := CVResult{
				Confidence:  confidence,
				Point:       topLeftPoint,
				SearchImage: searchImg,
				SourceImage: rImg,
			}

			if r.Confidence > res.Confidence && r.Confidence > 0.5 {
				res = r
			}
		}
	}

	if res.Confidence == 0 {
		return Coords{}, 0, errors.New("Cannot find image inside of source image")
	}

	coords := b.GetCoords(res.Point.X+res.SearchImage.Bounds().Dx()/2, res.Point.Y+res.SearchImage.Bounds().Dy()/2, res.SourceImage)

	return coords, res.Confidence, nil
}

func (b *BlueStacks) GetImagePathCoordsInImage(imagePath string, sourceImg image.Image) (Coords, float32, error) {
	searchImg, _, err := robotgo.DecodeImg(imagePath)
	if err != nil {
		return Coords{}, 0, fmt.Errorf("%v: %s", err, imagePath)
	}
	coords, confidence, err := b.GetImageCoordsInImage(searchImg, sourceImg)
	if err != nil {
		return coords, 0, fmt.Errorf("%v: %s", err, imagePath)
	}
	return coords, confidence, nil
}

func (b *BlueStacks) GetCoordsWithCache(getCoords func() (Coords, error), cacheKey string) (Coords, error) {
	var coords Coords
	var err error
	if v, found := coordsCache[cacheKey]; found {
		coords = v
	} else {
		coords, err = getCoords()
		if err != nil {
			return coords, err
		}
		coordsCache[cacheKey] = coords
	}
	return coords, nil
}

func (b *BlueStacks) DetectFaces(img image.Image, validity int) []image.Rectangle {
	// prepare image matrix
	screenMat, _ := gocv.ImageToMatRGB(img)
	defer screenMat.Close()

	// detect faces
	rects := b.FaceClassifier.DetectMultiScale(screenMat)
	var detectedFaces []image.Rectangle
	for _, r := range rects {
		if r.Dx() > validity {
			detectedFaces = append(detectedFaces, r)
		}
	}

	return detectedFaces
}

// Some Screen Movement Functions
func (b *BlueStacks) MoveToSharedFolderFromHome() error {
	b.ScrollUp(50) // Scroll up to ensure that gallery button shows.

	var err error
	var galleryControlCoords Coords
	var confidence float32
	if v, found := coordsCache["gallery"]; found {
		galleryControlCoords = v
	} else {
		screenImg := robotgo.CaptureImg()
		galleryControlCoords, confidence, err = b.GetImagePathCoordsInImage("./assets/faceapp/gallery.png", screenImg)
		log.Printf("DEBUG: Found gallery control with gallery.png - coords: %v , confidence: %v\n", galleryControlCoords, confidence)
		if err != nil || confidence < 0.9 {
			galleryControlCoords, confidence, err = b.GetImagePathCoordsInImage("./assets/faceapp/gallery-2.png", screenImg)
			log.Printf("DEBUG: Found gallery control with gallery-2.png - coords: %v , confidence: %v\n", galleryControlCoords, confidence)
			if err != nil || confidence < 0.9 {
				galleryControlCoords, _, err = b.GetImagePathCoordsInImage("./assets/faceapp/gallery-3.png", screenImg)
				log.Printf("DEBUG: Found gallery control with gallery-3.png - coords: %v , confidence: %v\n", galleryControlCoords, confidence)
				if err != nil {
					return err
				}
			}
		}
		coordsCache["gallery"] = galleryControlCoords
	}
	// log.Printf("DEBUG: Scrolling to Gallery Coords %v\n", galleryControlCoords)
	b.MoveClick(galleryControlCoords.X, galleryControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for animation to finish

	var folderFilterControlCoords Coords
	if v, found := coordsCache["filterFolder"]; found {
		folderFilterControlCoords = v
	} else {
		screenImg := robotgo.CaptureImg()
		folderFilterControlCoords, _, err = b.GetImagePathCoordsInImage("./assets/faceapp/folder-filter.png", screenImg)
		if err != nil {
			return err
		}
		coordsCache["filterFolder"] = folderFilterControlCoords
	}
	b.MoveClick(folderFilterControlCoords.X, folderFilterControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for animation to finish

	//* Opting for a Hotkey approach to minimise room for error
	robotgo.KeyTap("down")
	robotgo.KeyTap("down")
	robotgo.KeyTap("down")
	robotgo.KeyTap("enter")
	robotgo.KeyTap("tab")
	robotgo.MilliSleep(1000) // Wait for the shared folder gallery to actually load

	return nil
}

func (b *BlueStacks) OsBackClick() error {
	var err error
	var backControlCoords Coords
	if v, found := coordsCache["osback"]; found {
		backControlCoords = v
	} else {
		screenImg := robotgo.CaptureImg()
		backControlCoords, _, err = b.GetImagePathCoordsInImage("./assets/faceapp/os-back.png", screenImg)
		if err != nil {
			return err
		}
		coordsCache["osback"] = backControlCoords
	}

	b.MoveClick(backControlCoords.X, backControlCoords.Y)
	robotgo.MilliSleep(1000)

	return nil
}

// Used within the Enhancements Loop
func (b *BlueStacks) ExitScreen(shouldExitModal bool) error {
	err := b.OsBackClick()
	if err != nil {
		return err
	}
	if shouldExitModal {
		robotgo.MilliSleep(1000)
		exitModalScreen := robotgo.CaptureImg()
		exitCoords, err := b.GetCoordsWithCache(func() (Coords, error) {
			coords, _, err := b.GetImagePathCoordsInImage("./assets/faceapp/exit.png", exitModalScreen)
			return coords, err
		}, "exit")
		if err != nil {
			return err
		}
		b.MoveClick(exitCoords.X, exitCoords.Y)
		robotgo.MilliSleep(1000)
	}

	return nil
}
