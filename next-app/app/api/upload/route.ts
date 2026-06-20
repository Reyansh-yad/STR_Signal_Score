import { NextResponse } from "next/server"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 })
    }

    const isCsvUpload = files.length === 1 && files[0].name.endsWith(".csv")
    const datasetId = Date.now().toString()
    
    // Directory paths
    const uploadDir = path.join(process.cwd(), "..", "data", "uploads", datasetId)
    const xmlDir = path.join(uploadDir, "reports")
    const outputDir = path.join(process.cwd(), "..", "outputs", "compare")
    const outputFile = path.join(outputDir, `${datasetId}.csv`)

    await mkdir(uploadDir, { recursive: true })
    await mkdir(xmlDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    if (isCsvUpload) {
      // It's a pre-scored CSV, just save it to the outputs directory
      const file = files[0]
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(outputFile, buffer)
      
      return NextResponse.json({ 
        success: true, 
        datasetId,
        message: "CSV successfully uploaded" 
      })
    }

    // Otherwise, assume it's a batch of XML files
    const xmlFiles = files.filter(f => f.name.endsWith(".xml"))
    if (xmlFiles.length === 0) {
      return NextResponse.json({ error: "No valid XML or CSV files found" }, { status: 400 })
    }

    // Save all XML files
    await Promise.all(
      xmlFiles.map(async (file) => {
        const filePath = path.join(xmlDir, file.name)
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filePath, buffer)
      })
    )

    // Run the Python pipeline
    // Assuming python is in PATH and we run it from the workspace root
    const rootDir = path.join(process.cwd(), "..")
    const cmd = `python src/pipeline.py --reports "${xmlDir}" --output "${outputFile}"`
    
    try {
      await execAsync(cmd, { cwd: rootDir })
    } catch (execError: any) {
      console.error("Pipeline execution failed:", execError)
      return NextResponse.json({ 
        error: "Pipeline execution failed", 
        details: execError.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      datasetId,
      message: `Processed ${xmlFiles.length} reports successfully` 
    })

  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
