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
  (let ((tmpfile (make-temp-file "delisp_format")))
    (write-region (point-min) (point-max) tmpfile)
    (apply #'call-process delisp-program nil nil nil
           (list "format" tmpfile))
    (insert-file-contents-literally tmpfile nil nil nil t)))

(defun delisp-indent-line ()
  "Indent Delisp line."
  (let ((position (point))
        (indent-pos))
    (save-excursion
      (let ((level (car (syntax-ppss (point-at-bol)))))

        ;; Handle closing pairs
        (when (looking-at "\\s-*\\s)")
          (setq level (1- level)))

        (indent-line-to (* delisp-indent-level level))
        (setq indent-pos (point))))

    (when (< position indent-pos)
      (goto-char indent-pos))))


(defvar delisp-font-lock-keywords
  (list
   (list "(\\\(define\\\)\\s-*\\\(\\sw+\\\)"
         '(1 font-lock-keyword-face)
         '(2 font-lock-variable-name-face))
   (list
    (concat "(" (regexp-opt '("if" "lambda" "let" "export" "and" "or" "the") t) "\\>")
    '(1 font-lock-keyword-face))

   (list
    (concat "(" (regexp-opt '("->") t) "\\>")
    '(1 font-lock-type-face))

   (list
    (regexp-opt '("number" "string" "boolean") 'symbols)
    '(1 font-lock-type-face))

   ;; Built-ins
   (list
    (regexp-opt '("map" "filter" "fold") 'symbols)
    '(1 font-lock-builtin-face))

   ;; Delisp `:' keywords as builtins.
   '("\\<:\\sw+\\>" . font-lock-builtin-face)
   )
  "Expressions to highlight in Delisp mode.")


(defvar delisp-mode-syntax-table
  (let ((st (make-syntax-table)))
    (modify-syntax-entry ?\{ "(}" st)
    (modify-syntax-entry ?\} "){" st)
    (modify-syntax-entry ?\[ "(]" st)
    (modify-syntax-entry ?\] ")[" st)
    st)
  "Syntax table for Delisp mode.")

;;;###autoload
(define-derived-mode delisp-mode prog-mode "Delisp"
  "Major mode for editing Delisp code.

\\{delisp-mode-map}"
  :group 'delisp
  (setq-local indent-line-function 'delisp-indent-line)
  (setq font-lock-defaults '(delisp-font-lock-keywords nil nil (("+-*/.<>=!?$%_&:" . "w"))))
  (add-hook 'before-save-hook 'delisp-format-buffer nil 'local))

(provide 'delisp)
;;; delisp.el ends here
