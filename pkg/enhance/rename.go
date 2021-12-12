// A script to renmae the BlueStacks exported files to their appropriate image id using the produced info.json file

package main

import (
	"encoding/json"
	"fmt"
	"image"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/corona10/goimagehash"
	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
)

var (
	renameCmd = &cli.Command{
		Use:   "rename",
		Short: "Rename",
		Run:   Rename,
	}
)

func init() {
	rootCmd.AddCommand(renameCmd)

	renameCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	renameCmd.PersistentFlags().StringP("source", "s", "", "Path to source image directory where index.json is produced.")
	// renameCmd.PersistentFlags().StringP("reference-dir", "r", "", "Path to original step 2 reference images.")
	renameCmd.PersistentFlags().StringP("export", "e", "", "Path to directory where images were exported.")

	_ = renameCmd.MarkFlagRequired("source")
	_ = renameCmd.MarkFlagRequired("export")
}

func Rename(cmd *cli.Command, args []string) {
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDir, _ := cmd.Flags().GetString("source")
	exportDir, _ := cmd.Flags().GetString("export")

	log.Println("Start enhanced image renaming...")

	sourceBasename := filepath.Base(strings.TrimSuffix(sourceDir, "/"))
	outputDir := path.Join(outputParentDir, fmt.Sprintf("%s-rename", sourceBasename))
	err := os.MkdirAll(outputDir, 0755)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

	// Read info.json file
	// Read the index image enhancements, and their associated images.
	// Create an image distance against each of the exported images
	// The export image with the lowest distance is what is assigned the image id.
	// Write the new image to the output dir
	imageFileExtensions := []string{"jpeg", "jpg", "png"}
	var exportImgPaths []string
	for _, fileExt := range imageFileExtensions {
		filePaths, err := filepath.Glob(path.Join(exportDir, fmt.Sprintf("/*.%s", fileExt)))
		if err != nil {
			log.Fatal("ERROR: ", err)
		}
		exportImgPaths = append(exportImgPaths, filePaths...)
	}
	var enhancedImageIndex []IndexedImage
	indexFile, _ := ioutil.ReadFile(path.Join(sourceDir, "index.json"))
	_ = json.Unmarshal([]byte(indexFile), &enhancedImageIndex)

	writeCount := 0
	for _, enhancedImageData := range enhancedImageIndex {
		eImg, _, err := robotgo.DecodeImg(enhancedImageData.EnhancedImagePath)
		if err != nil {
			log.Fatal("ERROR: ", err)
		}
		eImgHash, err := goimagehash.PerceptionHash(eImg)
		if err != nil {
			log.Fatal("ERROR: ", err)
		}
		var matchedExportImg struct {
			Img      image.Image
			ImgPath  string
			Distance int
		}
		for _, exportImgPath := range exportImgPaths {
			expImg, _, err := robotgo.DecodeImg(exportImgPath)
			if err != nil {
				log.Fatal("ERROR: ", err)
			}
			expImgHash, err := goimagehash.PerceptionHash(expImg)
			if err != nil {
				log.Fatal("ERROR: ", err)
			}
			distance, err := eImgHash.Distance(expImgHash)
			if err != nil {
				log.Fatal("ERROR: ", err)
			}
			if distance < matchedExportImg.Distance || matchedExportImg.ImgPath == "" {
				matchedExportImg = struct {
					Img      image.Image
					ImgPath  string
					Distance int
				}{
					Img:      expImg,
					ImgPath:  exportImgPath,
					Distance: distance,
				}
			}
		}

		if gcv.ImgWrite(path.Join(outputDir, fmt.Sprintf("%s.jpg", enhancedImageData.Id)), matchedExportImg.Img) {
			log.Printf("Successfully renamed image %v : %v\n", enhancedImageData.EnhancedImagePath, enhancedImageData.Id)
			writeCount++
		} else {
			log.Printf("Failed to rename image %v : %v\n", enhancedImageData.EnhancedImagePath, enhancedImageData.Id)
		}
	}

	log.Printf("%d of %d enhanced images renamed!", writeCount, len(enhancedImageIndex))
}
