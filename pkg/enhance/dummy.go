// This command is only used to test things...

package main

import (
	"q"
	"time"

	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
)

var (
	dummyCmd = &cli.Command{
		Use:   "dummy",
		Short: "Dummy",
		Run:   Dummy,
	}
)

func init() {
	rootCmd.AddCommand(dummyCmd)
}

func Dummy(cmd *cli.Command, args []string) {
	// Setup Bluestacks
	bluestacks := NewBlueStacks()
	bluestacks.StartOCR()
	defer bluestacks.OCRClient.Close()
	time.Sleep(1 * time.Second) // Just pause to ensure there is a window change.
	sImg := robotgo.CaptureImg()
	coords, err := bluestacks.GetTextCoordsInImage("Contouring", sImg)
	q.Q(coords, err)
}
