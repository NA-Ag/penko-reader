import JSZip from 'jszip';

export const readEpubFile = async (file: File): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(file);
    
    // 1. Find the OPF file path from META-INF/container.xml
    const container = await zip.file("META-INF/container.xml")?.async("text");
    if (!container) throw new Error("Invalid EPUB: Missing container.xml");
    
    const opfPathMatch = container.match(/full-path="([^"]+)"/);
    if (!opfPathMatch) throw new Error("Invalid EPUB: Cannot find OPF path");
    const opfPath = opfPathMatch[1];
    const rootDir = opfPath.substring(0, opfPath.lastIndexOf('/'));

    // 2. Read the OPF file to get the spine (order of chapters)
    const opfContent = await zip.file(opfPath)?.async("text");
    if (!opfContent) throw new Error("Invalid EPUB: Missing OPF file");

    // Parse manifest items (id -> href)
    const manifest: Record<string, string> = {};
    const itemRegex = /<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(opfContent)) !== null) {
      manifest[itemMatch[1]] = itemMatch[2];
    }

    // Parse spine (order of ids)
    const spineRegex = /<itemref[^>]*idref="([^"]+)"/g;
    const spineIds: string[] = [];
    let spineMatch;
    while ((spineMatch = spineRegex.exec(opfContent)) !== null) {
      spineIds.push(spineMatch[1]);
    }

    // 3. Read each chapter in order
    let fullText = "";
    
    for (const id of spineIds) {
      const href = manifest[id];
      if (href) {
        // Resolve path relative to OPF location
        const filePath = rootDir ? `${rootDir}/${href}` : href;
        const content = await zip.file(filePath)?.async("text");
        
        if (content) {
          // Simple HTML strip (can be improved with DOMParser if needed)
          const doc = new DOMParser().parseFromString(content, "text/html");
          const text = doc.body.textContent || "";
          
          // Clean up whitespace
          const cleanText = text.replace(/\s+/g, ' ').trim();
          if (cleanText.length > 0) {
            fullText += cleanText + "\n\n";
          }
        }
      }
    }

    return fullText;
  } catch (error) {
    console.error("EPUB parsing error:", error);
    throw new Error("Failed to parse EPUB file");
  }
};