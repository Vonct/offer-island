import Foundation
import Vision
import AppKit
let args=CommandLine.arguments
if args.count < 2 { exit(1) }
do {
 let request=VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["zh-Hans", "en-US"]
 request.usesLanguageCorrection = true
 let handler=VNImageRequestHandler(url:URL(fileURLWithPath:args[1]),options:[:])
 try handler.perform([request])
 print((request.results ?? []).compactMap{$0.topCandidates(1).first?.string}.joined(separator:"\n"))
} catch { fputs("OCR failed: \(error)\n",stderr);exit(1) }
