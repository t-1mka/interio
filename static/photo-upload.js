/**
 * photo-upload.js — Загрузка фото помещения
 * Добавляет drag & drop зону для загрузки до 5 фото
 */
(function() {
    if (typeof window.photoUploads === 'undefined') {
        window.photoUploads = [];
    }

    function createPhotoUpload() {
        var container = document.createElement('div');
        container.className = 'photo-upload-section';
        container.style.cssText = 'margin:20px 0;padding:20px;border:2px dashed var(--border-color,rgba(0,0,0,0.1));border-radius:12px;text-align:center;';
        container.innerHTML = '\
            <div style="font-size:2rem;margin-bottom:8px;">📸</div>\
            <h3 style="font-size:1rem;margin:0 0 8px;color:var(--text-main);">Загрузите фото помещения</h3>\
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 16px;">До 5 фотографий (JPG, PNG, WEBP, макс. 5MB)</p>\
            <div id="photoDropZone" style="padding:30px;border:2px dashed var(--border-color,rgba(0,0,0,0.1));border-radius:8px;cursor:pointer;transition:all 0.3s;">\
                <p style="margin:0;color:var(--text-secondary);">Перетащите фото сюда или <span style="color:var(--accent);font-weight:600;">нажмите для выбора</span></p>\
            </div>\
            <input type="file" id="photoFileInput" multiple accept="image/*" style="display:none;">\
            <div id="photoPreviewGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:16px;"></div>\
        ';

        var dropZone = container.querySelector('#photoDropZone');
        var fileInput = container.querySelector('#photoFileInput');
        var previewGrid = container.querySelector('#photoPreviewGrid');

        // Click to select
        dropZone.addEventListener('click', function() { fileInput.click(); });

        // Drag & drop
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent,#2563eb)';
            dropZone.style.background = 'rgba(37,99,235,0.05)';
        });
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color,rgba(0,0,0,0.1))';
            dropZone.style.background = 'transparent';
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color,rgba(0,0,0,0.1))';
            dropZone.style.background = 'transparent';
            handleFiles(e.dataTransfer.files);
        });

        // File input
        fileInput.addEventListener('change', function(e) { handleFiles(e.target.files); });

        function handleFiles(files) {
            var remaining = 5 - window.photoUploads.length;
            var toProcess = Array.from(files).slice(0, remaining);
            
            toProcess.forEach(function(file) {
                if (!file.type.startsWith('image/')) return;
                if (file.size > 5 * 1024 * 1024) {
                    alert('Файл слишком большой (макс. 5MB)');
                    return;
                }
                
                var reader = new FileReader();
                reader.onload = function(e) {
                    var idx = window.photoUploads.length;
                    window.photoUploads.push({
                        name: file.name,
                        data: e.target.result,
                        file: file
                    });
                    renderPhoto(idx);
                };
                reader.readAsDataURL(file);
            });

            if (window.photoUploads.length >= 5) {
                dropZone.style.display = 'none';
            }
        }

        function renderPhoto(idx) {
            var photo = window.photoUploads[idx];
            var div = document.createElement('div');
            div.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;aspect-ratio:1;';
            div.innerHTML = '\
                <img src="' + photo.data + '" style="width:100%;height:100%;object-fit:cover;">\
                <button onclick="window.removePhoto(' + idx + ')" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(239,68,68,0.9);color:white;border:none;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">&times;</button>\
            ';
            previewGrid.appendChild(div);
        }

        // Insert before the form submit button or at the end of the quiz step
        var quizStep = document.querySelector('.quiz-step[data-step="6"]') || 
                       document.querySelector('.contact-form')?.parentElement ||
                       document.querySelector('#leadForm')?.parentElement;
        if (quizStep) {
            quizStep.insertBefore(container, quizStep.querySelector('.quiz-nav') || quizStep.lastChild);
        }

        return container;
    }

    window.removePhoto = function(idx) {
        window.photoUploads.splice(idx, 1);
        var previewGrid = document.getElementById('photoPreviewGrid');
        if (previewGrid) {
            previewGrid.innerHTML = '';
            window.photoUploads.forEach(function(_, i) {
                // Re-render all photos
                var photo = window.photoUploads[i];
                var div = document.createElement('div');
                div.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;aspect-ratio:1;';
                div.innerHTML = '\
                    <img src="' + photo.data + '" style="width:100%;height:100%;object-fit:cover;">\
                    <button onclick="window.removePhoto(' + i + ')" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(239,68,68,0.9);color:white;border:none;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">&times;</button>\
                ';
                previewGrid.appendChild(div);
            });
        }
        var dropZone = document.getElementById('photoDropZone');
        if (dropZone && window.photoUploads.length < 5) {
            dropZone.style.display = 'block';
        }
    };

    window.getPhotoUrls = function() {
        return window.photoUploads.map(function(p) { return p.data; });
    };

    // Create on quiz page
    if (document.querySelector('.quiz-section') || document.querySelector('#quizContainer')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createPhotoUpload);
        } else {
            setTimeout(createPhotoUpload, 500);
        }
    }
})();
