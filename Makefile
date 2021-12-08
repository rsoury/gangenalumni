VERSION := 1.0.0

.PHONY: default
default:
	# Compiling...
	make clean
	make snapcamera
	make enhance

.PHONY: clean
clean:
	rm -rf ./bin/snapcamera
	rm -rf ./bin/enhance

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