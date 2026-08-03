export async function readMobiFile(file: File): Promise<{ text: string; coverUrl?: string }> {
  const buffer = await file.arrayBuffer();
  const view = new Uint8Array(buffer);

  // Read number of records (offset 76, 2 bytes big-endian)
  const numRecords = (view[76] << 8) | view[77];

  const recordOffsets: number[] = [];
  for (let i = 0; i < numRecords; i++) {
    const recOffset = 78 + i * 8;
    const offset = (view[recOffset] << 24) | (view[recOffset+1] << 16) | (view[recOffset+2] << 8) | view[recOffset+3];
    recordOffsets.push(offset);
  }

  if (recordOffsets.length === 0) {
    throw new Error("Invalid MOBI file: No records found");
  }

  // Record 0 contains MOBI header info
  const rec0Start = recordOffsets[0];
  const rec0End = recordOffsets[1] || view.length;
  const mobiHeader = view.subarray(rec0Start, rec0End);

  // Compression type: offset 0 (2 bytes)
  const compression = (mobiHeader[0] << 8) | mobiHeader[1];

  // Text record count: offset 8 (2 bytes)
  const textRecordCount = (mobiHeader[8] << 8) | mobiHeader[9];

  let rawText = '';
  
  // Decompress PalmDoc algorithm helper
  const decompressPalmDoc = (data: Uint8Array): string => {
    let offset = 0;
    const out: number[] = [];
    
    while (offset < data.length) {
      const c = data[offset++];
      if (c === 0) {
        out.push(32); // Space
      } else if (c >= 1 && c <= 8) {
        for (let i = 0; i < c && offset < data.length; i++) {
          out.push(data[offset++]);
        }
      } else if (c >= 9 && c <= 0x7f) {
        out.push(c);
      } else if (c >= 0x80 && c <= 0xbf) {
        if (offset < data.length) {
          const c2 = data[offset++];
          const pair = ((c << 8) | c2) & 0x3fff;
          const distance = pair >> 3;
          const length = (pair & 7) + 3;
          
          const start = out.length - distance;
          for (let i = 0; i < length; i++) {
            out.push(out[start + i]);
          }
        }
      } else {
        out.push(32);
        out.push(c ^ 0x80);
      }
    }
    
    return new TextDecoder('utf-8').decode(new Uint8Array(out));
  };

  // Extract text records
  for (let i = 1; i <= textRecordCount; i++) {
    if (i >= recordOffsets.length) break;
    const start = recordOffsets[i];
    const end = recordOffsets[i + 1] || view.length;
    const recordData = view.subarray(start, end);

    if (compression === 2) {
      rawText += decompressPalmDoc(recordData);
    } else {
      rawText += new TextDecoder('utf-8').decode(recordData);
    }
  }

  // Extract cover image if present
  let coverUrl: string | undefined;
  // MOBI header starts at offset 16 in Record 0
  if (mobiHeader.length > 16 + 132) {
    const mobiHeaderStart = 16;
    const firstImageIndex = (mobiHeader[mobiHeaderStart + 80] << 24) | 
                            (mobiHeader[mobiHeaderStart + 81] << 16) | 
                            (mobiHeader[mobiHeaderStart + 82] << 8) | 
                            mobiHeader[mobiHeaderStart + 83];
                            
    const coverImageIndex = (mobiHeader[mobiHeaderStart + 128] << 24) | 
                            (mobiHeader[mobiHeaderStart + 129] << 16) | 
                            (mobiHeader[mobiHeaderStart + 130] << 8) | 
                            mobiHeader[mobiHeaderStart + 131];

    if (coverImageIndex !== 0xffffffff && firstImageIndex !== 0xffffffff) {
      const coverRecordIndex = firstImageIndex + coverImageIndex;
      if (coverRecordIndex < recordOffsets.length) {
        const start = recordOffsets[coverRecordIndex];
        const end = recordOffsets[coverRecordIndex + 1] || view.length;
        const imageBytes = view.subarray(start, end);
        
        if (imageBytes.length > 0) {
          let mimeType = 'image/jpeg';
          if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4e && imageBytes[3] === 0x47) {
            mimeType = 'image/png';
          } else if (imageBytes[0] === 0x47 && imageBytes[1] === 0x49 && imageBytes[2] === 0x46) {
            mimeType = 'image/gif';
          }
          
          let binary = '';
          const len = imageBytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(imageBytes[i]);
          }
          const base64 = btoa(binary);
          coverUrl = `data:${mimeType};base64,${base64}`;
        }
      }
    }
  }

  // Strip raw HTML tagging that exists inside MOBI files
  const cleanText = rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  return { text: cleanText, coverUrl };
}
