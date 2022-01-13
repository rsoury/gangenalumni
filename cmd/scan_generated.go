// A script to scan through generated human faces and determine whether there are duplicates
// // or there are humans with too many facial features.

package main

import (
	"fmt"
	"log"
	"path"
	"path/filepath"
	"sync"
	"time"

	"github.com/briandowns/spinner"
	cli "github.com/spf13/cobra"
	"github.com/vcaesar/imgo"
)

var (
	scanGeneratedCmd = &cli.Command{
		Use:   "scan",
		Short: "Scan directory of generated images for duplicates or invalid humans",
		Run:   ScanGenerated,
	}
)

func init() {
	rootCmd.AddCommand(scanGeneratedCmd)

	scanGeneratedCmd.PersistentFlags().Int("max-queue", 20, "Maximum number of parallel images to process")
}

func ScanGenerated(cmd *cli.Command, args []string) {
	sourceDir, _ := cmd.Flags().GetString("source")
	maxQueue, _ := cmd.Flags().GetInt("max-queue")
	queue := make(chan string, maxQueue)
	s := spinner.New(spinner.CharSets[9], 100*time.Millisecond)
	s.Start()
	sStatus := [][2]string{}
	similars := [][2]string{}

	// Populate the array.
	for i := 0; i < maxQueue; i++ {
		sStatus = append(sStatus, [2]string{})
	}

	log.Println("Start directory scan...")

	filePaths, err := filepath.Glob(path.Join(sourceDir, "/*.jpeg"))
	if err != nil {
		log.Fatal("ERROR: ", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < maxQueue; i++ {
		wg.Add(1)
		go func(index int) {
			for sourceImagePath := range queue {
				srcFilename := filepath.Base(sourceImagePath)
				srcExtension := filepath.Ext(srcFilename)
				srcId := srcFilename[0 : len(srcFilename)-len(srcExtension)]
				srcImg, _, _ := imgo.DecodeFile(sourceImagePath)
				sStatus[index][0] = srcId
				for _, compareImagePath := range filePaths {
					if sourceImagePath == compareImagePath {
						continue
					}
					cmpFilename := filepath.Base(compareImagePath)
					cmpExtension := filepath.Ext(cmpFilename)
					cmpId := cmpFilename[0 : len(cmpFilename)-len(cmpExtension)]

					// Update suffix
					sStatus[index][1] = cmpId
					suffix := "\n"
					for _, status := range sStatus {
						suffix += fmt.Sprintf("Comparing source %s to %s\n", status[0], status[1])
					}
					s.Suffix = suffix

					cmpImg, _, _ := imgo.DecodeFile(compareImagePath)
					isSimilar := imagesSimilar(srcImg, cmpImg)
					if isSimilar {
						similars = append(similars, [2]string{srcId, cmpId})
					}
				}
			}
			wg.Done()
		}(i)
	}

	for _, sourceImagePath := range filePaths {
		queue <- sourceImagePath
	}

	close(queue)
	wg.Wait()
	s.Stop()

	log.Println("All done!\nResult:")
	for _, similar := range similars {
		log.Println(fmt.Sprintf("Source %s similar to %s", similar[0], similar[1]))
	}
}
