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

(defvar delisp-font-lock-keywords
  (list
   (list "(\\\(define\\\)\\s-*\\\(\\sw+\\\)"
         '(1 font-lock-keyword-face)
         '(2 font-lock-variable-name-face))
   (list
    (concat "(" (regexp-opt '("if" "lambda" "let" "export" "and" "or") t) "\\>")
    '(1 font-lock-keyword-face))
   ;; Delisp `:' and `#:' keywords as builtins.
   ;; '("\\<#?:\\sw+\\>" . font-lock-builtin-face)
   )
  "Expressions to highlight in Delisp mode.")

;;;###autoload
(define-derived-mode delisp-mode prog-mode "Delisp"
  "Major mode for editing Delisp code.

\\{delisp-mode-map}"
  :group 'delisp
  (setq font-lock-defaults '(delisp-font-lock-keywords nil nil nil)))

(provide 'delisp)
;;; delisp.el ends here
