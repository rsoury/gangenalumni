package main

import (
	"testing"
)

// Shuffle the Types and return a new Types array
func TestShuffleTypes(t *testing.T) {
	for _, enh := range enhancements {
		types := enh.ShuffleTypes()
		// q.Q(types, enh.Types)
		existsCount := 0
		for _, eType := range enh.Types {
			// Check that each original enh type is available in the shuffled type
			for _, sType := range types {
				if eType.Name == sType.Name {
					existsCount++
					break
				}
			}
		}
		if existsCount != len(enh.Types) {
			t.Logf("Original Enhancement Types [Length: %d] do not exist with shuffled Types -- with an existence count of %d", len(enh.Types), existsCount)
			t.Fail()
		}
		// if types[0].Name == enh.Types[0].Name && types[len(types)-1].Name == enh.Types[len(enh.Types)-1].Name {
		// 	t.Logf("")
		// 	t.Fail()
		// }
	}
}
