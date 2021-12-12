// A script to isolate images that are to be processed manually through glasses enhancements.

package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	cli "github.com/spf13/cobra"
)

type FaceById struct {
	Id   string
	Data FaceData
}

var (
	glassesCmd = &cli.Command{
		Use:   "glasses",
		Short: "Prepare glasses directory",
		Run:   PrepareGlassesDirectory,
	}
)

func init() {
	rootCmd.AddCommand(glassesCmd)

	glassesCmd.PersistentFlags().StringP("output", "o", "./output/step2.1", "Path to local output directory.")
	glassesCmd.PersistentFlags().StringArrayP("source", "s", []string{}, "Path to source image directories. Can be both enhanced image directory and original step2 directory.")
	glassesCmd.PersistentFlags().StringP("facedata", "f", "", "Path to AWS Face Analysis dataset directory.")
	glassesCmd.PersistentFlags().IntP("limit", "l", 1000, "Limit on the number of images prepared.")

	_ = glassesCmd.MarkFlagRequired("source")
}

func PrepareGlassesDirectory(cmd *cli.Command, args []string) {
	outputParentDir, _ := cmd.Flags().GetString("output")
	sourceDirs, _ := cmd.Flags().GetStringArray("source")
	facedataDir, _ := cmd.Flags().GetString("facedata")
	limit, _ := cmd.Flags().GetInt("limit")

	log.Println("Start preparing of images for glasses enhancement...")

	sourceBasename := filepath.Base(strings.TrimSuffix(sourceDirs[0], "/"))
	outputDir := path.Join(outputParentDir, fmt.Sprintf("%s-for-glasses", sourceBasename))
	err := os.MkdirAll(outputDir, 0755)
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
	var remaining []FaceById
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

		filename := filepath.Base(facedataPath)
		extension := filepath.Ext(filename)
		name := filename[0 : len(filename)-len(extension)]

		if faceDetails.Eyeglasses.Value || faceDetails.Sunglasses.Value {
			// Move the file to the new directory.
			processed = append(processed, FaceById{
				Id:   name,
				Data: facedata,
			})
			count++
		} else if *faceDetails.AgeRange.Low > 5 && *faceDetails.AgeRange.High > 5 {
			remaining = append(remaining, FaceById{
				Id:   name,
				Data: facedata,
			})
		}
	}

	// Pick randomly from the remaining
	r := rand.New(rand.NewSource(time.Now().Unix()))
	for {
		if limit > 0 {
			if count >= limit {
				break
			}
		}
		randIndex := r.Intn(len(remaining))
		element := remaining[randIndex]
		remaining = append(remaining[:randIndex], remaining[randIndex+1:]...)

		processed = append(processed, element)
		count++

		if len(remaining) == 0 {
			break
		}
	}

	var imageIndex []IndexedImage
	imageFileExtensions := []string{"jpeg", "jpg", "png"}
	for _, f := range processed {
		var imgPath string
		var imgExt string
		for _, sourceDir := range sourceDirs { // Source directory order takes priority
			for _, fileExt := range imageFileExtensions {
				proposedFilePath := path.Join(sourceDir, fmt.Sprintf("/%s.%s", f.Id, fileExt))
				if _, err := os.Stat(proposedFilePath); err == nil {
					imgPath = proposedFilePath
					imgExt = fileExt
					break
				}
			}
			if imgPath != "" {
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

		imageIndex = append(imageIndex, IndexedImage{
			Id:                f.Id,
			EnhancedImagePath: outputFile,
		})
	}

	imageIndexJson, err := json.Marshal(imageIndex)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	jsonFile, err := os.Create(path.Join(outputDir, "index.json"))
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	defer jsonFile.Close()
	_, err = jsonFile.Write(imageIndexJson)
	if err != nil {
		log.Fatal("ERROR: ", err.Error())
	}
	jsonFile.Close()
	log.Println("JSON data written to ", jsonFile.Name())

	log.Printf("%d [Count: %d] images prepared for glasses enhancement!\n", len(processed), count)
}
