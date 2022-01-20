package main

import "github.com/aws/aws-sdk-go-v2/service/rekognition/types"

type IndexedImage struct {
	Id                string              `json:"id"`
	Enhancements      []map[string]string `json:"enhancements"`
	EnhancedImagePath string              `json:"enhancedImagePath"`
}

type FaceData struct {
	FaceDetails []types.FaceDetail `json:"FaceDetails"`
}

type FaceById struct {
	Id   string
	Data FaceData
}

var (
	// Index each face to an output directory
	imageIndex []IndexedImage
)
