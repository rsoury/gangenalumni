package main

import (
	"errors"
	"fmt"
	"image"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/go-vgo/robotgo"
	"github.com/otiai10/gosseract/v2"
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
	OCRClient      *gosseract.Client
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
type OCRResult struct {
	Bounds      gosseract.BoundingBox
	SourceImage image.Image
}

var (
	coordsCache = map[string]Coords{}
)

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

func (b *BlueStacks) LoadFaceClassifier(cascadeFile string) error {
	// load classifier to recognize faces
	classifier := gocv.NewCascadeClassifier()
	defer classifier.Close()

	if !classifier.Load(cascadeFile) {
		return fmt.Errorf("Error reading cascade file: %v\n", cascadeFile)
	}

	b.FaceClassifier = classifier

	return nil
}

func (b *BlueStacks) StartOCR() {
	b.OCRClient = gosseract.NewClient()
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

func (b *BlueStacks) GetTextCoordsInImage(text string, img image.Image, level gosseract.PageIteratorLevel) (Coords, error) {
	// Produce multiple sizes for the search image
	var res OCRResult
	for i := 0; i <= 9; i++ {
		resizeWidth := int(math.Round(float64(img.Bounds().Dx()) * (1.0 - float64(i)/10.0)))
		rImg := imaging.Resize(img, resizeWidth, 0, imaging.Lanczos)
		// q.Q(i, resizeWidth, rImg.Bounds().Dx())
		rMat, _ := gocv.ImageToMatRGB(rImg)

		// Seems greyscaling the image help with OCR.
		gocv.CvtColor(rMat, &rMat, gocv.ColorBGRAToGray)

		imgBytes, err := ImageToBytes(img)
		if err != nil {
			log.Fatal(err.Error())
		}
		_ = b.OCRClient.SetImageFromBytes(imgBytes)

		boxes, err := b.OCRClient.GetBoundingBoxes(level)
		if err != nil {
			return Coords{}, err
		}
		if len(boxes) == 0 {
			return Coords{}, errors.New("Cannot find the FaceApp '" + text + "' Text using OCR")
		}

		for _, box := range boxes {
			if strings.Contains(box.Word, text) {
				if box.Confidence > res.Bounds.Confidence {
					res = OCRResult{
						Bounds:      box,
						SourceImage: rImg,
					}
				}
				break
			}
		}
	}

	coords := b.GetCoords(res.Bounds.Box.Min.X+res.Bounds.Box.Dx()/2, res.Bounds.Box.Min.Y+res.Bounds.Box.Dy()/2, res.SourceImage)

	return coords, nil
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
func (b *BlueStacks) GetImageCoordsInImage(searchImg, sourceImg image.Image) (Coords, error) {
	searchMat, _ := gocv.ImageToMatRGB(searchImg)
	defer searchMat.Close()

	// Produce multiple sizes for the search image
	var res CVResult
	for i := 0; i <= 9; i++ {
		resizeWidth := int(math.Round(float64(sourceImg.Bounds().Dx()) * (1.0 - float64(i)/10.0)))
		rImg := imaging.Resize(sourceImg, resizeWidth, 0, imaging.Lanczos)
		// q.Q(i, resizeWidth, rImg.Bounds().Dx())
		if rImg.Bounds().Dx() < searchImg.Bounds().Dx() {
			break // Break the loop if the source image resize becomes smaller than the search image.
		}
		// Then process the results to determine the most common coordinate location on the sourceImg
		srcMat, _ := gocv.ImageToMatRGB(rImg)
		defer srcMat.Close()
		if debugMode {
			gcv.ImgWrite("./tmp/enhance-debug/"+strconv.FormatInt(currentTs, 10)+"/screen-resized-"+strconv.Itoa(int(time.Now().Unix()))+".jpg", rImg)
		}
		_, confidence, _, topLeftPoint := gcv.FindImgMat(searchMat, srcMat)

		r := CVResult{
			Confidence:  confidence,
			Point:       topLeftPoint,
			SearchImage: searchImg,
			SourceImage: rImg,
		}

		if r.Confidence > res.Confidence {
			res = r
		}
	}

	if res.Confidence == 0 {
		return Coords{}, errors.New("Cannot find image inside of source image")
	}

	coords := b.GetCoords(res.Point.X+res.SearchImage.Bounds().Dx()/2, res.Point.Y+res.SearchImage.Bounds().Dy()/2, res.SourceImage)

	return coords, nil
}

func (b *BlueStacks) GetImagePathCoordsInImage(imagePath string, sourceImg image.Image) (Coords, error) {
	searchImg, _, _ := robotgo.DecodeImg(imagePath)
	coords, err := b.GetImageCoordsInImage(searchImg, sourceImg)
	if err != nil {
		return coords, fmt.Errorf("%v: %s", err, imagePath)
	}
	return coords, nil
}

func (b *BlueStacks) DetectFacesInScreen() ([]image.Rectangle, gocv.Mat) {
	// prepare image matrix
	screenImg := robotgo.CaptureImg()
	screenMat, _ := gocv.ImageToMatRGB(screenImg)
	defer screenMat.Close()

	// detect faces
	rects := b.FaceClassifier.DetectMultiScale(screenMat)
	var detectedFaces []image.Rectangle
	for _, r := range rects {
		if r.Dx() > 100 {
			detectedFaces = append(detectedFaces, r)
		}
	}

	return detectedFaces, screenMat
}

// Some Screen Movement Functions
func (b *BlueStacks) MoveToSharedFolderFromHome() error {
	b.ScrollUp(50) // Scroll up to ensure that gallery button shows.

	var err error
	var galleryControlCoords Coords
	if v, found := coordsCache["gallery"]; found {
		galleryControlCoords = v
	} else {
		screenImg := robotgo.CaptureImg()
		if debugMode {
			gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/screen-0.jpg", currentTs), screenImg)
		}
		galleryControlCoords, err = b.GetImagePathCoordsInImage("./assets/faceapp/gallery.png", screenImg)
		if err != nil {
			return err
		}
		coordsCache["gallery"] = galleryControlCoords
	}
	b.MoveClick(galleryControlCoords.X, galleryControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for animation to finish

	var folderFilterControlCoords Coords
	if v, found := coordsCache["filterFolder"]; found {
		folderFilterControlCoords = v
	} else {
		screenImg := robotgo.CaptureImg()
		if debugMode {
			gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/screen-1.jpg", currentTs), screenImg)
		}
		folderFilterControlCoords, err = b.GetImagePathCoordsInImage("./assets/faceapp/folder-filter.png", screenImg)
		if err != nil {
			return err
		}
		coordsCache["filterFolder"] = folderFilterControlCoords
	}
	b.MoveClick(folderFilterControlCoords.X, folderFilterControlCoords.Y)
	robotgo.MilliSleep(1000) // Wait for animation to finish

	var sharedFolderControlCoords Coords
	if v, found := coordsCache["sharedFolder"]; found {
		sharedFolderControlCoords = v
	} else {
		screenImg := robotgo.CaptureImg()
		if debugMode {
			gcv.ImgWrite(fmt.Sprintf("./tmp/enhance-debug/%d/screen-2.jpg", currentTs), screenImg)
		}
		sharedFolderControlCoords, err = b.GetTextCoordsInImage("SharedFolder", screenImg, gosseract.RIL_WORD)
		if err != nil {
			return err
		}
		coordsCache["sharedFolder"] = sharedFolderControlCoords
	}
	b.MoveClick(sharedFolderControlCoords.X, sharedFolderControlCoords.Y)
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
		backControlCoords, err = b.GetImagePathCoordsInImage("./assets/faceapp/os-back.png", screenImg)
		if err != nil {
			return err
		}
		coordsCache["osback"] = backControlCoords
	}

	b.MoveClick(backControlCoords.X, backControlCoords.Y)
	robotgo.MilliSleep(1000)

	return nil
}
