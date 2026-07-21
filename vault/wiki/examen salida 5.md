Plataforma

Título
<xsl:value-of select="/plataforma/nombre"/>-
<xsl:value-of select="/plataforma/plan"/>

Calidad
<p>Calidad: <p>
<xsl:choose>
<!Maxima>
<xsl:when plan="Premium">
<p>Maxima<p>
</xsl:when>
<!Buena>
<xsl:when plan="Estandar">
<p>Buena<p>
</xsl:when>
<!Limitada>
<xsl:when plan="Basico">
<p>Limitada<p>
</xsl:when>
</xsl:choose>

Contenidos vistos
<h1>Contenidos vistos:<h1>
<ol>
<xsl:for-each select="/contenidos/contenido">
<li>
<xsl:value-of select="./titulo"/>
</li>
<li>
Fecha:
<xsl:value-of select="./fecha"/>
</li>
Duración:
<xsl:value-of select="./duracion"/>
minutos
</li>
</xsl:for-each>
</ol>

[[calidad]]
[[contenidos]]
[[plataforma]]