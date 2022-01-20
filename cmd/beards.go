// 20-10-2022 -- A script to isolate step2 images where face data indicates a beard or mustache

package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	cli "github.com/spf13/cobra"
)

var (
	beardsCmd = &cli.Command{
		Use:   "beards",
		Short: "Prepare beards directory",
		Run:   PrepareBeardsDirectory,
	}
)

func init() {
	rootCmd.AddCommand(beardsCmd)

	beardsCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	beardsCmd.PersistentFlags().StringP("source", "s", "", "Path to source image directories. Can be both enhanced image directory and original step2 directory.")
	beardsCmd.PersistentFlags().StringP("facedata", "f", "", "Path to AWS Face Analysis dataset directory.")
	beardsCmd.PersistentFlags().IntP("limit", "l", 1000, "Limit on the number of images prepared.")

	_ = beardsCmd.MarkFlagRequired("source")
}

func PrepareBeardsDirectory(cmd *cli.Command, args []string) {
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDir, _ := cmd.Flags().GetString("source")
	facedataDir, _ := cmd.Flags().GetString("facedata")
	limit, _ := cmd.Flags().GetInt("limit")

	log.Println("Isolating images to apply beards...")

	sourceBasename := filepath.Base(strings.TrimSuffix(sourceDir, "/"))
	outputDir := path.Join(outputParentDir, fmt.Sprintf("%s-with-beards", sourceBasename))
	err := os.RemoveAll(outputDir)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}
	err = os.MkdirAll(outputDir, 0755)
	if err != nil {
		log.Fatalln("ERROR:", err)
	}

	// Setup Face Analysis Data Paths - Fetch all the JSON paths from the facedata directory
	facedataPaths, err := filepath.Glob(path.Join(facedataDir, "/*.json"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}

	// Fetch the facedata details
	count := 0
	var processed []FaceById
	for _, facedataPath := range facedataPaths {
		if limit > 0 {
			if count >= limit {
				break
			}
		}

		facedata := FaceData{}
		// Read the file and unmarshal the data
		file, _ := ioutil.ReadFile(facedataPath)
		_ = json.Unmarshal([]byte(file), &facedata)

		faceDetails := facedata.FaceDetails[0]

		name := getFileName(facedataPath)

		if faceDetails.Beard.Value || faceDetails.Mustache.Value {
			// Move the file to the new directory.
			processed = append(processed, FaceById{
				Id:   name,
				Data: facedata,
			})
			count++
		}
	}

	imageFileExtensions := []string{"jpeg", "jpg", "png"}
	for _, f := range processed {
		var imgPath string
		var imgExt string
		for _, fileExt := range imageFileExtensions {
			proposedFilePath := path.Join(sourceDir, fmt.Sprintf("/%s.%s", f.Id, fileExt))
			if _, err := os.Stat(proposedFilePath); err == nil {
				imgPath = proposedFilePath
				imgExt = fileExt
				break
			}
		}

		input, err := ioutil.ReadFile(imgPath)
		if err != nil {
			log.Fatalf("ERROR: Cannot read file %v - %v\n", imgPath, err.Error())
		}

		outputFile := path.Join(outputDir, fmt.Sprintf("%v.%v", f.Id, imgExt))
		err = ioutil.WriteFile(outputFile, input, 0644)
		if err != nil {
			log.Fatalf("ERROR: Cannot write file %v -> %v - %v\n", imgPath, outputFile, err.Error())
		}

		log.Printf("Successfully prepared image %v - %v", f.Id, outputFile)
	}

	log.Printf("%d [Count: %d] images prepared for beards enhancement!\n", len(processed), count)
}
