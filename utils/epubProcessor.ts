import JSZip from 'jszip';

export const readEpubFile = async (file: File): Promise<{ text: string; coverUrl?: string }> => {
  try {
    const zip = await JSZip.loadAsync(file);
    
    // 1. Find OPF
    const containerXml = await zip.file("META-INF/container.xml")?.async("text");
    if (!containerXml) throw new Error("Invalid EPUB: container.xml not found");
    
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, "text/xml");
    const rootFile = containerDoc.getElementsByTagName("rootfile")[0];
    const opfPath = rootFile?.getAttribute("full-path");
    if (!opfPath) throw new Error("Invalid EPUB: full-path not found");
    
    const rootDir = opfPath.substring(0, opfPath.lastIndexOf('/'));
    const getPath = (href: string) => rootDir ? `${rootDir}/${href}` : href;

    // 2. Read OPF
    const opfContent = await zip.file(opfPath)?.async("text");
    if (!opfContent) throw new Error("Invalid EPUB: OPF content missing");
    const opfDoc = parser.parseFromString(opfContent, "text/xml");
    
    // 3. Parse Manifest (Resources)
    const manifestItems = Array.from(opfDoc.getElementsByTagName("item"));
    const manifest: Record<string, { href: string; type: string }> = {};
    
    manifestItems.forEach(item => {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      const mediaType = item.getAttribute("media-type");
      if (id && href) {
        manifest[id] = { href, type: mediaType || "" };
      }
    });

    // 4. Parse Spine (Reading Order)
    const spine = opfDoc.getElementsByTagName("spine")[0];
    const itemrefs = Array.from(spine.getElementsByTagName("itemref"));
    const spineIds = itemrefs.map(ref => ref.getAttribute("idref")).filter(id => id) as string[];

    // 5. Pre-load Assets (Images, CSS) to Blob URLs
    const assetMap: Record<string, string> = {};
    
    for (const id in manifest) {
      const { href, type } = manifest[id];
      // Load images and css
      if (type.startsWith("image/") || type === "text/css") {
        const fullPath = getPath(href);
        const file = zip.file(fullPath);
        if (file) {
          const blob = await file.async("blob");
          assetMap[fullPath] = URL.createObjectURL(blob);
        }
      }
    }

    // 6. Extract Cover
    let coverUrl: string | undefined;
    const metaCover = Array.from(opfDoc.getElementsByTagName("meta")).find(m => m.getAttribute("name") === "cover");
    if (metaCover) {
      const coverId = metaCover.getAttribute("content");
      if (coverId && manifest[coverId]) {
        coverUrl = assetMap[getPath(manifest[coverId].href)];
      }
    }
    if (!coverUrl) {
      const coverItem = manifestItems.find(i => i.getAttribute("properties")?.includes("cover-image"));
      if (coverItem) {
        coverUrl = assetMap[getPath(coverItem.getAttribute("href") || "")];
      }
    }

    // 7. Process Chapters
    let fullHtml = "";
    
    for (const id of spineIds) {
      const item = manifest[id];
      if (!item) continue;
      
      const chapterPath = getPath(item.href);
      const chapterContent = await zip.file(chapterPath)?.async("text");
      
      if (chapterContent) {
        const doc = parser.parseFromString(chapterContent, "text/html");
        
        // Replace asset URLs
        const elements = doc.querySelectorAll("*[src], *[href]");
        elements.forEach(el => {
          const src = el.getAttribute("src");
          const href = el.getAttribute("href");
          
          if (src) {
            const absPath = resolvePath(chapterPath, src);
            if (assetMap[absPath]) el.setAttribute("src", assetMap[absPath]);
          }
          if (href && el.tagName.toLowerCase() === "link") {
             const absPath = resolvePath(chapterPath, href);
             if (assetMap[absPath]) el.setAttribute("href", assetMap[absPath]);
          }
        });

        // Ensure images fit
        const images = doc.querySelectorAll("img");
        images.forEach(img => {
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            img.style.display = "block";
            img.style.margin = "0 auto";
        });

        if (doc.body) {
          fullHtml += `<div id="${id}" class="chapter-container" style="position: relative;">${doc.body.innerHTML}</div>`;
        }
      }
    }

    return { text: fullHtml, coverUrl };

  } catch (error) {
    console.error("EPUB parsing error:", error);
    throw new Error("Failed to parse EPUB file");
  }
};

const resolvePath = (base: string, relative: string): string => {
  const stack = base.split('/');
  stack.pop();
  
  const parts = relative.split('/');
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
};