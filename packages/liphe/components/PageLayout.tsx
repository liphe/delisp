import React from "react";
import Link from "next/link";

export const PageLayout: React.FC = ({ children }) => {
  return (
    <div>
      <ul>
        <li>
          <Link href="/">
            <a>Home</a>
          </Link>
        </li>
        <li>
          <Link href="/pprinter">
            <a>Pretty printer</a>
          </Link>
        </li>
      </ul>
      <div>{children}</div>

      <style jsx>
        {`
          ul > li {
            display: inline-block;
            padding-left: 20px;
          }
        `}
      </style>
    </div>
  );
};
