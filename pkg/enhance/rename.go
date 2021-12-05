package main

import (
	cli "github.com/spf13/cobra"
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
}

func Rename(cmd *cli.Command, args []string) {
	// ...
}
