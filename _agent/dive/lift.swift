// usage: swift lift.swift in.png out_mask.png   — macOS Vision subject lifting → 8-bit mask
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
guard let ci = CIImage(contentsOf: inURL) else { print("cannot read"); exit(1) }
let handler = VNImageRequestHandler(ciImage: ci, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
do {
  try handler.perform([req])
  guard let obs = req.results?.first else { print("no subject"); exit(2) }
  print("instances:", obs.allInstances.count)
  let buf = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
  let mask = CIImage(cvPixelBuffer: buf)
  let ctx = CIContext()
  let cs = CGColorSpace(name: CGColorSpace.linearGray)!
  guard let cg = ctx.createCGImage(mask, from: mask.extent, format: .L8, colorSpace: cs) else { print("no cg"); exit(3) }
  let rep = NSBitmapImageRep(cgImage: cg)
  try rep.representation(using: .png, properties: [:])!.write(to: outURL)
  print("wrote", outURL.path, cg.width, cg.height)
} catch { print("error:", error); exit(4) }
