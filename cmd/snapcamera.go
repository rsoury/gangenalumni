// A script to rename the BlueStacks exported files to their appropriate image id using the produced info.json file

package main

import (
	"fmt"

	"github.com/go-vgo/robotgo"
	cli "github.com/spf13/cobra"
)

var (
	snapcameraCmd = &cli.Command{
		Use:   "snapcamera",
		Short: "Trigger Snap Camera Photo Save",
		Run:   SnapCamera,
	}
)

func init() {
	rootCmd.AddCommand(snapcameraCmd)
}

func SnapCamera(cmd *cli.Command, args []string) {
	fpid, err := robotgo.FindIds("Snap Camera")
	if err != nil {
		fmt.Errorf(err.Error())
	}
	fmt.Println(fpid)
	robotgo.ActivePID(fpid[0])

	robotgo.KeySleep = 100
	robotgo.KeyTap("j", "shift", "control")
}
