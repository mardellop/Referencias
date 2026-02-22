// APA 7 Metadata Extractor
// Handles automatic extraction of citation metadata from URLs

class MetadataExtractor {
    constructor() {
        // API endpoints
        this.microlinkAPI = 'https://api.microlink.io/';
        this.youtubeOEmbed = 'https://www.youtube.com/oembed';
        this.crossrefAPI = 'https://api.crossref.org/works/';
    }

    /**
     * Main extraction method - orchestrates metadata extraction from URL or File
     * @param {string|File} source - The URL or File to extract metadata from
     * @returns {Promise<Object>} Extracted metadata
     */
    async extractMetadata(source) {
        try {
            if (source instanceof File) {
                return await this.extractFromPDF(source);
            }

            // Validate URL
            const validatedUrl = this.validateURL(source);
            if (!validatedUrl) {
                throw new Error('URL inválida');
            }

            // Detect source type
            const sourceType = this.detectSourceType(validatedUrl);

            // Extract based on type
            let metadata;
            switch (sourceType) {
                case 'youtube':
                    metadata = await this.extractFromYouTube(validatedUrl);
                    break;
                case 'doi':
                    metadata = await this.extractFromDOI(validatedUrl);
                    break;
                default:
                    metadata = await this.extractFromWebsite(validatedUrl);
            }

            return {
                ...metadata,
                sourceType,
                url: validatedUrl,
                extractedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Metadata extraction error:', error);
            throw error;
        }
    }

    /**
     * Extract metadata from a PDF file using pdf.js and text analysis
     * @param {File} file - PDF file object
     * @returns {Promise<Object>} Extracted metadata
     */
    async extractFromPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const typedarray = new Uint8Array(reader.result);

                    // Initialize pdf.js
                    const pdfjsLib = window['pdfjs-dist/build/pdf'];
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                    const loadingTask = pdfjsLib.getDocument(typedarray);
                    const pdf = await loadingTask.promise;

                    // 1. Get basic metadata from PDF info
                    const meta = await pdf.getMetadata();
                    const info = meta.info || {};

                    // 2. Extract text from first 2 pages for deeper analysis
                    const textContent = await this.extractPdfText(pdf, 2);

                    // 3. Search for DOI in extracted text
                    const doi = this.findDOIInText(textContent);
                    if (doi) {
                        try {
                            const doiMetadata = await this.extractFromDOI(`https://doi.org/${doi}`);
                            resolve({
                                ...doiMetadata,
                                sourceType: 'doi',
                                extractedAt: new Date().toISOString()
                            });
                            return;
                        } catch (e) {
                            console.warn('DOI found but Crossref extraction failed, falling back to heuristics');
                        }
                    }

                    // 4. Apply heuristics to text content if no DOI or Crossref fails
                    const heuristics = this.applyPdfHeuristics(textContent, info, file.name);

                    resolve({
                        title: heuristics.title,
                        author: heuristics.author,
                        date: heuristics.date,
                        publisher: heuristics.publisher,
                        url: '',
                        type: heuristics.type,
                        extractedAt: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('PDF extraction error:', error);
                    reject(new Error('No se pudo leer el archivo PDF o extraer sus metadatos'));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Extract text content from specified number of pages
     */
    async extractPdfText(pdf, maxPages) {
        let fullText = '';
        const numPages = Math.min(pdf.numPages, maxPages);

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    }

    /**
     * Search for DOI pattern in text
     */
    findDOIInText(text) {
        // Common DOI regex
        const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
        const match = text.match(doiRegex);
        return match ? match[0] : null;
    }

    /**
     * Apply heuristics to determine metadata from text and PDF info
     */
    applyPdfHeuristics(text, info, fileName) {
        // 1. Title Heuristic
        let title = info.Title || '';
        if (!title || title.trim().length < 5 || /Microsoft Word|Adobe|Acrobat/i.test(title)) {
            const lines = text.split('\n')
                .map(l => l.trim())
                .filter(l => {
                    // Filter out "junk" lines that are definitely not titles
                    if (l.length < 5 || l.length > 200) return false; // Lowered to 5
                    if (/^Vol\.|Issue|Page|Págs?|doi:|https?:\/\/|www\./i.test(l)) return false;
                    if (/^\d+$/.test(l)) return false; // Just numbers
                    if (/Microsoft Word|Adobe|Acrobat/i.test(l)) return false; // Filter software from text lines too
                    return true;
                });

            // Only use the first line if it looks like a real title, otherwise use filename (santized)
            title = lines[0] || fileName.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
        }

        // 2. Author Heuristic (Supporting accents)
        let author = this.parseAuthor(info.Author) || '';
        if (!author || /Microsoft|Adobe|Acrobat|User|Usuario/i.test(author)) {
            author = ''; // Clear junk metadata to allow searching text
            const authorPatterns = [
                // Use [ \t]+ instead of \s+ to avoid matching across newlines
                /(?:By|Por|Authors?|Autores?|Coordinado por|Editor|Editores?):[ \t]*([A-Z\u00C0-\u00DE][a-z\u00DF-\u00FF]+(?:[ \t]+[A-Z\u00C0-\u00DE][a-z\u00DF-\u00FF]+)*)/i,
                /(?:^|\n)([A-Z\u00C0-\u00DE][a-z\u00DF-\u00FF]+(?:[ \t]+[A-Z\u00C0-\u00DE][a-z\u00DF-\u00FF]+){1,3})(?:\r?\n|$)/
            ];

            for (const pattern of authorPatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    const candidate = match[1].trim();
                    // Filter out common false positives
                    if (!/University|Journal|Review|Volume|Issue|Abstract|Resumen|Introduction|Introducción|Title|Document/i.test(candidate)) {
                        author = this.parseAuthor(candidate);
                        if (author) break;
                    }
                }
            }
        }

        // 3. Year Heuristic (Conservative)
        let year = '';
        if (info.CreationDate) {
            const dateObj = this.parseDate(info.CreationDate);
            year = dateObj.year;
        }

        const currentYear = new Date().getFullYear();
        if (!year || parseInt(year) < 1900 || parseInt(year) > currentYear + 1) {
            const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
            if (yearMatches) {
                year = yearMatches[0];
            } else {
                year = '';
            }
        }

        // 4. Publisher/Producer (Filter software)
        let publisher = info.Producer || info.Creator || '';
        if (/Microsoft|Word|Adobe|Acrobat|Distiller|LaTeX|macOS|Writer|Office/i.test(publisher)) {
            publisher = '';
        }

        return {
            title: title.trim(),
            author: author.trim(),
            date: { year },
            publisher: publisher.trim(),
            type: text.toLowerCase().includes('journal') || text.toLowerCase().includes('article') ? 'journal' : ''
        };
    }


    /**
     * Validate and normalize URL
     * @param {string} url - URL to validate
     * @returns {string|null} Validated URL or null
     */
    validateURL(url) {
        try {
            // Add protocol if missing
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            const urlObj = new URL(url);
            return urlObj.href;
        } catch (e) {
            return null;
        }
    }

    /**
     * Detect the type of source from URL
     * @param {string} url - The URL to analyze
     * @returns {string} Source type
     */
    detectSourceType(url) {
        const urlLower = url.toLowerCase();

        // YouTube
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
            return 'youtube';
        }

        // DOI
        if (urlLower.includes('doi.org/') || urlLower.match(/10\.\d{4,}/)) {
            return 'doi';
        }

        // Default to website
        return 'website';
    }

    /**
     * Extract metadata from general websites using Microlink API
     * @param {string} url - Website URL
     * @returns {Promise<Object>} Extracted metadata
     */
    async extractFromWebsite(url) {
        try {
            const apiUrl = `${this.microlinkAPI}?url=${encodeURIComponent(url)}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error('Error al obtener metadatos del sitio web');
            }

            const data = await response.json();

            if (!data.status === 'success') {
                throw new Error('No se pudieron extraer los metadatos');
            }

            const { title, author, date, publisher, description, logo } = data.data;

            return {
                title: title || 'Sin título',
                author: this.parseAuthor(author),
                date: this.parseDate(date),
                siteName: publisher || this.extractDomain(url),
                description: description,
                favicon: logo?.url,
                type: 'website'
            };

        } catch (error) {
            console.error('Website extraction error:', error);
            // Fallback to basic extraction
            return {
                title: 'Sin título',
                author: '',
                date: { year: new Date().getFullYear().toString() },
                siteName: this.extractDomain(url),
                type: 'website'
            };
        }
    }

    /**
     * Extract metadata from YouTube videos
     * @param {string} url - YouTube URL
     * @returns {Promise<Object>} Extracted metadata
     */
    async extractFromYouTube(url) {
        try {
            const apiUrl = `${this.youtubeOEmbed}?url=${encodeURIComponent(url)}&format=json`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error('Error al obtener datos del video');
            }

            const data = await response.json();

            // Also get additional metadata from Microlink for date
            let publishDate = { year: new Date().getFullYear().toString() };
            try {
                const microlinkUrl = `${this.microlinkAPI}?url=${encodeURIComponent(url)}`;
                const mlResponse = await fetch(microlinkUrl);
                if (mlResponse.ok) {
                    const mlData = await mlResponse.json();
                    if (mlData.data?.date) {
                        publishDate = this.parseDate(mlData.data.date);
                    }
                }
            } catch (e) {
                console.warn('Could not get publish date from Microlink');
            }

            return {
                title: data.title || 'Sin título',
                author: data.author_name || 'Autor desconocido',
                date: publishDate,
                platform: 'YouTube',
                type: 'video'
            };

        } catch (error) {
            console.error('YouTube extraction error:', error);
            throw new Error('No se pudo extraer información del video de YouTube');
        }
    }

    /**
     * Extract metadata from DOI (academic papers)
     * @param {string} url - DOI URL
     * @returns {Promise<Object>} Extracted metadata
     */
    async extractFromDOI(url) {
        try {
            // Extract DOI from URL
            const doiMatch = url.match(/10\.\d{4,}\/[^\s]+/);
            if (!doiMatch) {
                throw new Error('DOI no válido');
            }

            const doi = doiMatch[0];
            const apiUrl = `${this.crossrefAPI}${doi}`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error('Error al obtener datos del DOI');
            }

            const data = await response.json();
            const work = data.message;

            // Parse authors - get all authors and format according to APA 7
            const authors = this.formatMultipleAuthors(
                work.author?.map(a => ({
                    family: a.family,
                    given: a.given
                })) || []
            );

            // Parse date
            const datePublished = work.published?.['date-parts']?.[0];
            const date = datePublished ? {
                year: datePublished[0]?.toString() || '',
                month: datePublished[1]?.toString() || '',
                day: datePublished[2]?.toString() || ''
            } : { year: '' };

            // Determine if it's a journal article or book
            const isJournal = work.type === 'journal-article';

            return {
                title: work.title?.[0] || 'Sin título',
                author: authors,
                date: date,
                journalName: work['container-title']?.[0] || '',
                volume: work.volume || '',
                issue: work.issue || '',
                pages: work.page || '',
                doi: `https://doi.org/${doi}`,
                publisher: work.publisher || '',
                type: isJournal ? 'journal' : 'book'
            };

        } catch (error) {
            console.error('DOI extraction error:', error);
            throw new Error('No se pudo extraer información del DOI');
        }
    }

    /**
     * Parse author string into APA format
     * @param {string} author - Author string
     * @returns {string} Formatted author
     */
    parseAuthor(author) {
        if (!author) return '';

        // If already in "Last, F." format, return as is
        if (author.match(/^[A-Z][a-z]+,\s*[A-Z]\./)) {
            return author;
        }

        // Try to parse "First Last" format
        const parts = author.trim().split(/\s+/);
        if (parts.length >= 2) {
            const lastName = parts[parts.length - 1];
            const firstName = parts[0];
            return `${lastName}, ${firstName.charAt(0)}.`;
        }

        return author;
    }

    /**
     * Format multiple authors according to APA 7 rules
     * @param {Array} authors - Array of author objects with family and given names
     * @returns {string} Formatted author string
     */
    formatMultipleAuthors(authors) {
        if (!authors || authors.length === 0) return '';

        // Format each author as "Last, F."
        const formattedAuthors = authors.map(author => {
            const family = author.family || '';
            const given = author.given || '';
            const initial = given.charAt(0);
            return `${family}, ${initial}.`;
        });

        // APA 7 rules for multiple authors:
        // 1-2 authors: Author1, A. y Author2, B.
        // 3-20 authors: Author1, A., Author2, B., ... y AuthorN, N.
        // 21+ authors: First 19, ..., Last author

        if (formattedAuthors.length === 1) {
            return formattedAuthors[0];
        } else if (formattedAuthors.length === 2) {
            return `${formattedAuthors[0]} y ${formattedAuthors[1]}`;
        } else if (formattedAuthors.length <= 20) {
            const allButLast = formattedAuthors.slice(0, -1).join(', ');
            const last = formattedAuthors[formattedAuthors.length - 1];
            return `${allButLast} y ${last}`;
        } else {
            // 21+ authors: show first 19, ellipsis, then last author
            const first19 = formattedAuthors.slice(0, 19).join(', ');
            const last = formattedAuthors[formattedAuthors.length - 1];
            return `${first19}, ... ${last}`;
        }
    }

    /**
     * Parse date string into components
     * @param {string} dateString - Date string
     * @returns {Object} Date components {year, month, day}
     */
    parseDate(dateString) {
        if (!dateString) {
            return { year: new Date().getFullYear().toString() };
        }

        try {
            const date = new Date(dateString);

            if (isNaN(date.getTime())) {
                // Try to extract just the year
                const yearMatch = dateString.match(/\d{4}/);
                return {
                    year: yearMatch ? yearMatch[0] : new Date().getFullYear().toString()
                };
            }

            const months = [
                'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
            ];

            return {
                year: date.getFullYear().toString(),
                month: months[date.getMonth()],
                day: date.getDate().toString()
            };

        } catch (e) {
            return { year: new Date().getFullYear().toString() };
        }
    }

    /**
     * Extract domain name from URL
     * @param {string} url - URL
     * @returns {string} Domain name
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return 'Sitio web';
        }
    }
}

// Export for use in main script
window.MetadataExtractor = MetadataExtractor;
