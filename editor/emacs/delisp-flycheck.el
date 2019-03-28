;;; delisp-flycheck.el ---                           -*- lexical-binding: t; -*-

;; Copyright (C) 2019  David Vazquez

;; Author: David Vazquez <davazp@emmy.local>
;; Keywords: languages, convenience

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

(require 'flycheck)

(flycheck-define-checker delisp
  "Delisp syntax checker."
  :command ("delisp" "lint" source)
  :error-patterns
  ((error line-start "file:" line ":" column ": " (message) line-end))
  :modes delisp-mode
  :next-checkers ((warning . scala-scalastyle)))

(add-to-list 'flycheck-checkers 'delisp)

(provide 'delisp-flycheck)
;;; delisp-flycheck.el ends here
