// A script to fill the missing images from the rename step in a new output -- using the original images from step 2

package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	cli "github.com/spf13/cobra"
	"github.com/vcaesar/gcv"
	"github.com/vcaesar/imgo"
)

var (
	combineCmd = &cli.Command{
		Use:   "combine",
		Short: "Combine",
		Long:  "Combine images from multiple directories",
		Run:   Combine,
	}
)

func init() {
	rootCmd.AddCommand(combineCmd)

	combineCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	combineCmd.PersistentFlags().StringArrayP("source", "s", []string{}, "Path to source image directories.")

	_ = combineCmd.MarkFlagRequired("source")
}

func Combine(cmd *cli.Command, args []string) {
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDirs, _ := cmd.Flags().GetStringArray("source")

	log.Println("Start combining image directories...")

	sourceBasename := filepath.Base(strings.TrimSuffix(sourceDirs[0], "/"))
	outputDir := path.Join(outputParentDir, fmt.Sprintf("%s-final", sourceBasename))
	err := os.MkdirAll(outputDir, 0755)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

	// Iterate over each source directory
	// If the image exists in the output, skip, otherwise write.
	imageFileExtensions := []string{"jpeg", "jpg", "png"}
	writeCount := 0
	for _, source := range sourceDirs {
		for _, fileExt := range imageFileExtensions {
			filePaths, err := filepath.Glob(path.Join(source, fmt.Sprintf("/*.%s", fileExt)))
			if err != nil {
				log.Fatal("ERROR: ", err)
			}
			for _, pathToFile := range filePaths {
				image, _, _ := imgo.DecodeFile(pathToFile)
				fileName := path.Base(pathToFile)
				extension := filepath.Ext(fileName)
				id := fileName[0 : len(fileName)-len(extension)]
				outputFilePath := path.Join(outputDir, fmt.Sprintf("%s.jpg", id))
				if _, err := os.Stat(outputFilePath); errors.Is(err, os.ErrNotExist) {
					// File does not exist
					if gcv.ImgWrite(path.Join(outputDir, fmt.Sprintf("%s.jpg", id)), image) {
						log.Printf("Successfully pushed image %v\n", outputFilePath)
						writeCount++
					} else {
						log.Printf("Failed to pushed image %v\n", outputFilePath)
					}
				}
			}
		}
	}

	log.Printf("%d images combined into a directory %s!\n", writeCount, outputDir)
}
