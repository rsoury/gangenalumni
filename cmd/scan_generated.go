// A script to scan through generated human faces and determine whether there are duplicates
// // or there are humans with too many facial features.

package main

import (
	"log"
	"path"
	"path/filepath"

	cli "github.com/spf13/cobra"
	"github.com/vcaesar/imgo"
)

var (
	scanGenerated = &cli.Command{
		Use:   "scan",
		Short: "Scan directory of generated images for duplicates or invalid humans",
		Run:   ScanGenerated,
	}
)

func init() {
	rootCmd.AddCommand(scanGenerated)

	_ = renameCmd.MarkFlagRequired("source")
}

func ScanGenerated(cmd *cli.Command, args []string) {
	sourceDir, _ := cmd.Flags().GetString("source")
	// cascadeFile, _ := cmd.Flags().GetString("cascade-file")

	log.Println("Start directory scan...")

	// // load classifier to recognize faces
	// classifier := gocv.NewCascadeClassifier()

	// if !classifier.Load(cascadeFile) {
	// 	log.Fatalf("Error reading cascade file: %v\n", cascadeFile)
	// }

	filePaths, err := filepath.Glob(path.Join(sourceDir, "/*.jpeg"))
	if err != nil {
		log.Fatal("ERROR: ", err)
	}

	for _, sourceImagePath := range filePaths {
		srcFilename := filepath.Base(sourceImagePath)
		srcExtension := filepath.Ext(srcFilename)
		srcId := srcFilename[0 : len(srcFilename)-len(srcExtension)]
		srcImg, _, _ := imgo.DecodeFile(sourceImagePath)

		for _, compareImagePath := range filePaths {
			if sourceImagePath == compareImagePath {
				continue
			}
			cmpFilename := filepath.Base(compareImagePath)
			cmpExtension := filepath.Ext(cmpFilename)
			cmpId := cmpFilename[0 : len(cmpFilename)-len(cmpExtension)]
			cmpImg, _, _ := imgo.DecodeFile(compareImagePath)
			isSimilar := imagesSimilar(srcImg, cmpImg)
			if isSimilar {
				log.Printf("WARN: %s similar to %s", srcId, cmpId)
			}
		}

		// // prepare image matrix
		// srcMat, _ := gocv.ImageToMatRGB(srcImg)
		// gocv.CvtColor(srcMat, &srcMat, gocv.ColorRGBAToGray)
		// defer srcMat.Close()

		// // detect eyes
		// eyesRects := classifier.DetectMultiScale(srcMat)
		// var detected []image.Rectangle
		// for _, r := range eyesRects {
		// 	if r.Dx() > 20 {
		// 		detected = append(detected, r)
		// 	}
		// }
		// log.Printf("DEBUG: detected %d eyes in %s", len(detected), srcId)
		// if len(detected) > 2 {
		// 	log.Printf("WARN: detected multiple faces in %s", srcId)
		// 	go func() {
		// 		borderColor := color.RGBA{0, 0, 255, 0}
		// 		imgMat, _ := gocv.ImageToMatRGB(srcImg)
		// 		defer imgMat.Close()
		// 		for _, r := range detected {
		// 			gocv.Rectangle(&imgMat, r, borderColor, 3)
		// 		}
		// 		if gocv.IMWrite(fmt.Sprintf("./tmp/scan-generated-debug/face-%s.jpeg", srcId), imgMat) {
		// 			log.Printf("Successfully created face-%v image with %d eyes detected\n", srcId, len(detected))
		// 		} else {
		// 			log.Printf("Failed to create face-%v image with %d eyes detected\n", srcId, len(detected))
		// 		}
		// 	}()
		// }
	}

	log.Println("All done!")
}
