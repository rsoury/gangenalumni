/**
 * Step 2.1 -- An optional step
 * Enhance the Human Avatars using FaceApp in BlueStacks
 * Developed in Golang for to use robotgo
 *
 * Requires that Bluestacks 4 is open, and that Media Manager has imported all images.
 * Running enhance go script requires opencv4 as a dependency.
 * -- IMPORTANT: Be sure to switch the FaceApp Gender Interface to "Female interface" for Asset Compatibility
 */

package main

import (
	"log"
	"time"

	cli "github.com/spf13/cobra"
)

var (
	// The Root Cli Handler
	rootCmd   = &cli.Command{}
	currentTs = time.Now().Unix()
	debugMode = false
)

func init() {
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Run the enhancement in debug mode. Will output images to tmp folder.")

}

func main() {
	// Run the program
	if err := rootCmd.Execute(); err != nil {
		log.Fatalln("ERROR:", err)
	}
}
