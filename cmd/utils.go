package main

import (
	"bytes"
	"image"
	"image/jpeg"
	"path/filepath"
	"strings"

	"github.com/go-vgo/robotgo"
	"github.com/vitali-fedulov/images/v2"
	"gocv.io/x/gocv"
)

func ImageToBytes(img image.Image) ([]byte, error) {
	buf := new(bytes.Buffer)
	err := jpeg.Encode(buf, img, nil)
	if err != nil {
		return buf.Bytes(), err
	}
	imgBytes := buf.Bytes()
	return imgBytes, nil
}

func getCollectionId(sourceDir string) string {
	basename := filepath.Base(strings.TrimSuffix(sourceDir, "/"))
	return "npcc-2-" + basename
}

func grayscaleImage(img image.Image) (image.Image, error) {
	iMat, err := gocv.ImageToMatRGB(img)
	if err != nil {
		return img, err
	}
	defer iMat.Close()
	// Seems greyscaling the image help with OCR.
	gocv.CvtColor(iMat, &iMat, gocv.ColorBGRToGray)
	nImg, err := iMat.ToImage()
	if err != nil {
		return img, err
	}
	return nImg, nil
}

// https://dsp.stackexchange.com/questions/59150/outlined-text-extraction-from-image-using-opencv
func intensifyTextInImage(img image.Image) (image.Image, error) {
	iMat, err := gocv.ImageToMatRGB(img)
	if err != nil {
		return img, err
	}
	defer iMat.Close()
	// Seems greyscaling the image help with OCR.
	gocv.CvtColor(iMat, &iMat, gocv.ColorBGRToGray)
	gocv.Threshold(iMat, &iMat, 245, 255, gocv.ThresholdBinary)
	elementMat := gocv.GetStructuringElement(gocv.MorphRect, image.Point{X: 3, Y: 3})
	gocv.MorphologyEx(iMat, &iMat, gocv.MorphClose, elementMat)
	gocv.BitwiseNot(iMat, &iMat)
	nImg, err := iMat.ToImage()
	if err != nil {
		return img, err
	}
	return nImg, nil
}

func EnsureChange(changeEvent func()) {
	for {
		preImg := robotgo.CaptureImg()
		changeEvent()
		postImg := robotgo.CaptureImg()
		if !imagesSimilar(preImg, postImg) {
			break
		}
	}
}

func imagesSimilar(imgA, imgB image.Image) bool {
	hashA, imgSizeA := images.Hash(imgA)
	hashB, imgSizeB := images.Hash(imgB)
	return images.Similar(hashA, hashB, imgSizeA, imgSizeB)
}
