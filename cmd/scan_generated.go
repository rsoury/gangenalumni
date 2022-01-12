// A script to rename the BlueStacks exported files to their appropriate image id using the produced info.json file

package main

import (
	cli "github.com/spf13/cobra"
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
}

func ScanGenerated(cmd *cli.Command, args []string) {
	// ...
}
