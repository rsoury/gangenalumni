package main

import (
	"bytes"
	"image"
	"image/jpeg"
	"path/filepath"
	"strings"
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
	return "npcc-2-" + filepath.Base(strings.TrimSuffix(sourceDir, "/"))
}
