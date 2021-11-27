VERSION := 1.0.0

.PHONY: default
default:
	# Compiling...
	snapcamera
	enhance

.PHONY: clean
clean:
	rm -rf ./bin/snapcamera

.PHONY: snapcamera
snapcamera:
	# Compiling Snapcamera script...
	go build -o bin/snapcamera ./pkg/snapcamera
	chmod +x bin/snapcamera

.PHONY: enhance
enhance:
	# Compiling Enhance script...
	go build -o bin/enhance ./pkg/enhance
	chmod +x bin/enhance