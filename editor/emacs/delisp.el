;;; delisp.el --- A emacs mode for Delisp            -*- lexical-binding: t; -*-

;; Copyright (C) 2019  David Vazquez

;; Author: David Vazquez <davazp@gmail.com>
;; Keywords: lisp, languages

;; This program is free software; you can redistribute it and/or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License, or
;; (at your option) any later version.

;; This program is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY; without even the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;; GNU General Public License for more details.

;; You should have received a copy of the GNU General Public License
;; along with this program.  If not, see <https://www.gnu.org/licenses/>.

;;; Commentary:

;;

;;; Code:

(require 'cl)
(require 'comint)
(require 'thingatpt)
(require 'pulse)

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.dl\\'" . delisp-mode))

;; Add support for dimmed parenthesis
(when (boundp 'paren-face-modes)
  (add-to-list 'paren-face-modes 'delisp-mode))


(defvar delisp-program
  "delisp"
  "Program to invoke to interact with delisp.")

(defvar delisp-indent-level 2
  "Number of spaces to use for indentation in Delisp programs.")

(defun delisp-format-buffer ()
  "Format file using delisp format."
  (interactive)
  (let ((tmpfile (make-temp-file "delisp_format"))
        (output-buffer (generate-new-buffer " *delisp-format*")))
    (unwind-protect
        (progn
          (write-region (point-min) (point-max) tmpfile nil 'silent)
          (let ((errcode (apply #'call-process delisp-program
                                nil
                                (list output-buffer t)
                                nil
                                (list "format" tmpfile))))
            (cond
             ((zerop errcode)
              (insert-file-contents tmpfile nil nil nil t))
             (t
              (let (line column message)

                (with-current-buffer output-buffer
                  (let ((stderr (buffer-substring (point-min) (point-max))))
                    (message "delisp-format-error: %s" stderr)
                    (goto-char (point-min))
                    (search-forward "file:")
                    (when (looking-at "\\([[:digit:]]+\\):\\([[:digit:]]+\\):\\(.*\\)")
                      (setq line (string-to-number (match-string 1))
                            column (1- (string-to-number (match-string 2)))
                            message (match-string 3)))))

                (message message))))))

      (kill-buffer output-buffer))))

(cl-defun delisp--calculate-indentation (pos)
  (save-excursion
    (cl-destructuring-bind (level parent-form-position &rest _)
        (syntax-ppss pos)

      ;; Toplevel form:
      ;; Indented to the first column.
      (when (not parent-form-position)
        (return-from delisp--calculate-indentation 0))

      (goto-char parent-form-position)
      (cond
       ;; Vector/map:
       ;; Align to the column of the first element
       ((find (char-after) "{[")
        (down-list)
        (forward-sexp)
        (backward-sexp)
        (current-column))
       ;; Lists?
       (t
        (down-list)
        (case (symbol-at-point)
          ((define lambda let the do match)
           (* delisp-indent-level level))
          ((multiple-value-bind)

           (condition-case err
               (forward-sexp 3)
             (scan-error
              err
              (goto-char (third err))))
           
           (if (< (point) pos)
               (* delisp-indent-level level)
             (* delisp-indent-level (+ level 1))))
          (t
           (forward-sexp 2)
           (backward-sexp)
           (current-column))))))))

(defun delisp-indent-line ()
  "Indent Delisp line."
  (let ((indent-to (delisp--calculate-indentation (point-at-bol)))
        indented-pos)
    (save-excursion
      (indent-line-to indent-to)
      (setq indented-pos (point)))
    (when (< (point) indented-pos)
      (goto-char indented-pos))))


(defun delisp-fontify-string (string)
  (with-temp-buffer
    (delisp-mode)
    (insert string)
    (font-lock-ensure (point-min) (point-max))
    (buffer-substring (point-min) (point-max))))


(defun delisp-infer-type (position)
  (let ((tmpfile (make-temp-file "delisp_infer"))
        (output-buffer (generate-new-buffer " *delisp-infer*")))
    (unwind-protect
        (progn
          (write-region (point-min) (point-max) tmpfile nil 'silent)
          (let ((errcode (apply #'call-process delisp-program
                                nil
                                (list output-buffer nil)
                                nil
                                (list "infer-type" tmpfile
                                      "--cursor-offset" (number-to-string position)))))
            (cond
             ((zerop errcode)
              (with-current-buffer output-buffer
                (let ((type (buffer-substring (point-min) (point-max))))
                  (if (string= type "")
                      nil
                    type))))
             (t
              nil))))
      (kill-buffer output-buffer))))


(defun delisp-mode-eldoc-function ()
  (let ((type (delisp-infer-type (point))))
    (when type
      (let ((highlighted-type (delisp-fontify-string type)))
        (concat (thing-at-point 'symbol) ": " highlighted-type)))))


(defvar delisp-font-lock-keywords
  (list
   (list "(\\\(define\\\)\\(?:\\s-+\\\(\\sw+\\\)\\)?"
         '(1 font-lock-keyword-face nil)
         '(2 font-lock-variable-name-face))

   (list "(\\\(type\\\)\\(?:\\s-+\\\(\\sw+\\\)\\)?"
         '(1 font-lock-keyword-face nil)
         '(2 font-lock-variable-name-face))

   (list
    (concat "(" (regexp-opt '("if" "lambda" "let" "export" "and" "case" "the" "do" "match" "multiple-value-bind" "values") t) "\\>")
    '(1 font-lock-keyword-face))

   (list
    (concat "(" (regexp-opt '("->") t) "\\>")
    '(1 font-lock-type-face))

   (list
    (regexp-opt '("number" "string" "boolean") 'symbols)
    '(1 font-lock-type-face))

   ;; Built-ins
   (list
    (regexp-opt '("true" "false" "map" "filter" "fold") 'symbols)
    '(1 font-lock-builtin-face))

   ;; Delisp `:' keywords as constants.
   '("\\<:\\sw+\\>" . font-lock-constant-face)

   ;; @-Expressions
   '("@\\w+" . font-lock-doc-face)
   '("@\\(TODO\\)" (1 'warning t))
   '("@url{\\([^}]*\\)}" (1 'link t))
   '("@ref{\\([^}]*\\)}" (1 font-lock-variable-name-face t))
   )
  "Expressions to highlight in Delisp mode.")

(defvar delisp-font-lock-defaults
  '(delisp-font-lock-keywords nil nil (("+-*/.<>=!?$%_&:" . "w"))))


(defvar delisp-mode-map
  (let ((map (make-sparse-keymap)))
    (set-keymap-parent map prog-mode-map)
    (define-key map (kbd "C-c C-z") #'delisp-switch-to-output-buffer)
    (define-key map (kbd "C-c C-c") #'delisp-send-toplevel)
    (define-key map (kbd "C-c C-l") #'delisp-send-buffer)
    map)
  "Keymap for Delisp mode.")

(defvar delisp-mode-syntax-table
  (let ((st (make-syntax-table)))
    (modify-syntax-entry ?\{ "(}" st)
    (modify-syntax-entry ?\} "){" st)
    (modify-syntax-entry ?\[ "(]" st)
    (modify-syntax-entry ?\] ")[" st)
    (modify-syntax-entry ?? "_" st)
    (modify-syntax-entry ?^ "w" st)
    st)
  "Syntax table for Delisp mode.")

;;;###autoload
(define-derived-mode delisp-mode prog-mode "Delisp"
  "Major mode for editing Delisp code.

\\{delisp-mode-map}"
  (setq comment-start "@doc{")
  (setq comment-padding "")
  (setq comment-end "}")
  (setq-local indent-line-function 'delisp-indent-line)
  (setq font-lock-defaults delisp-font-lock-defaults)
  (add-function :before-until (local 'eldoc-documentation-function) #'delisp-mode-eldoc-function)
  (add-hook 'before-save-hook 'delisp-format-buffer nil 'local))



;;;; REPL

(defvar delisp-repl-buffer "*delisp-repl*")

(define-derived-mode delisp-repl-mode comint-mode "Delisp-REPL"
  "Run a Delisp REPL."
  :syntax-table delisp-mode-syntax-table
  (ansi-color-for-comint-mode-on)
  (setq font-lock-defaults delisp-font-lock-defaults)
  (setq comint-process-echoes t)
  (setq-local comint-prompt-read-only t)
  (setq-local comint-use-prompt-regexp t)
  (setq-local comint-prompt-regexp "^λ"))

(defun delisp ()
  (interactive)
  (unless (executable-find delisp-program)
    (message "Delisp not found."))
  (let ((buffer (make-comint-in-buffer "Delisp-REPL" delisp-repl-buffer delisp-program nil)))
    (pop-to-buffer buffer)
    (delisp-repl-mode)))

(defun delisp-switch-to-output-buffer ()
  (interactive)
  (if (get-buffer delisp-repl-buffer)
      (pop-to-buffer delisp-repl-buffer)
    (delisp)))

(defun delisp-send-toplevel ()
  (interactive)
  (let* ((bounds (bounds-of-thing-at-point 'defun))
         (start (car bounds))
         (end (cdr bounds)))
    (let ((content (string-trim (buffer-substring start end))))
      (pulse-momentary-highlight-region start end)
      (comint-send-string delisp-repl-buffer (concat content "\n")))))

(defun delisp-send-buffer ()
  (interactive)
  (comint-send-region delisp-repl-buffer (point-min) (point-max))
  (comint-send-string delisp-repl-buffer "\n"))


(provide 'delisp)
;;; delisp.el ends here
