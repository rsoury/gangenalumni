package main

import (
	"fmt"

	"github.com/go-vgo/robotgo"
)

func main() {
	fpid, err := robotgo.FindIds("Snap Camera")
	if err != nil {
		fmt.Errorf(err.Error())
	}
	fmt.Println(fpid)
	robotgo.ActivePID(fpid[0])

	robotgo.KeySleep = 100
	robotgo.KeyTap("j", "shift", "control")
}
